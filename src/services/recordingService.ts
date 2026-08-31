import AsyncStorage from '@react-native-async-storage/async-storage';

import * as FileSystem from 'expo-file-system/legacy';

import * as Location from 'expo-location';

import type { RecordingData } from '@/types/recording';

const STORAGE_KEY =
    'recordings';

const VIDEO_DIR =
    FileSystem.documentDirectory +
    'recordings/';

/* ============================================================
 * VIDEO DIRECTORY
 * ============================================================ */

async function ensureVideoDir(): Promise<void> {
    const info =
        await FileSystem.getInfoAsync(
            VIDEO_DIR,
        );

    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(
            VIDEO_DIR,
            {
                intermediates:
                    true,
            },
        );
    }
}

/* ============================================================
 * VIDEO SAVE
 * ============================================================ */

async function persistVideoFile(
    tempUri: string,
    id: string,
): Promise<string> {
    await ensureVideoDir();

    const newPath =
        `${VIDEO_DIR}${id}.mp4`;

    await FileSystem.copyAsync({
        from: tempUri,

        to: newPath,
    });

    return newPath;
}

/* ============================================================
 * LOCATION
 * ============================================================ */

/**
 * 전달받은 location에 좌표가 이미 있으면 그대로 사용.
 *
 * 좌표가 없다면 현재 GPS를 가져와서 보완합니다.
 *
 * placeName은 사용자가 검색해서 지정한 장소명을 그대로 유지합니다.
 */
async function resolveRecordingLocation(
    location: RecordingData['location'],
): Promise<
    RecordingData['location']
> {
    /*
     * 이미 정상 GPS가 있다면
     * 위치 권한을 다시 요청할 필요 없음
     */

    const hasLatitude =
        typeof location
            ?.latitude ===
        'number' &&
        Number.isFinite(
            location.latitude,
        );

    const hasLongitude =
        typeof location
            ?.longitude ===
        'number' &&
        Number.isFinite(
            location.longitude,
        );

    if (
        hasLatitude &&
        hasLongitude
    ) {
        return location;
    }

    try {
        /* --------------------------------------------------------
         * 위치 권한 확인
         * -------------------------------------------------------- */

        let permission =
            await Location.getForegroundPermissionsAsync();

        if (
            permission.status !==
            'granted'
        ) {
            permission =
                await Location.requestForegroundPermissionsAsync();
        }

        /*
         * 사용자가 위치 권한을 거부한 경우
         * 기존 location을 그대로 저장
         */
        if (
            permission.status !==
            'granted'
        ) {
            console.warn(
                '[saveRecording] 위치 권한이 없어 GPS를 저장하지 못했습니다.',
            );

            return location;
        }

        /* --------------------------------------------------------
         * 현재 위치
         * -------------------------------------------------------- */

        const currentPosition =
            await Location.getCurrentPositionAsync(
                {
                    accuracy:
                        Location.Accuracy.Balanced,
                },
            );

        const latitude =
            currentPosition
                .coords
                .latitude;

        const longitude =
            currentPosition
                .coords
                .longitude;

        console.log(
            '[saveRecording] GPS:',
            latitude,
            longitude,
        );

        return {
            ...location,

            latitude,

            longitude,
        };
    } catch (error) {
        console.warn(
            '[saveRecording] GPS 조회 실패:',
            error,
        );

        return location;
    }
}

/* ============================================================
 * SAVE RECORDING
 * ============================================================ */

export async function saveRecording(
    data: Omit<
        RecordingData,
        'id' | 'videoUri'
    > & {
        videoUri: string;
    },
): Promise<RecordingData> {
    const id =
        `rec_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}`;

    /* ----------------------------------------------------------
     * 임시 영상 → 앱 내부 저장소
     * ---------------------------------------------------------- */

    const persistedUri =
        await persistVideoFile(
            data.videoUri,
            id,
        );

    /* ----------------------------------------------------------
     * GPS 확인
     * ---------------------------------------------------------- */

    const resolvedLocation =
        await resolveRecordingLocation(
            data.location,
        );

    /* ----------------------------------------------------------
     * Recording 생성
     * ---------------------------------------------------------- */

    const record: RecordingData =
    {
        ...data,

        id,

        videoUri:
            persistedUri,

        durationMs:
            data.durationMs ??
            0,

        location:
            resolvedLocation,
    };

    /* ----------------------------------------------------------
     * AsyncStorage 저장
     * ---------------------------------------------------------- */

    const existing =
        await getAllRecordings();

    const updated = [
        ...existing,
        record,
    ];

    await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
            updated,
        ),
    );

    console.log(
        '[saveRecording] 저장 완료:',
        {
            id:
                record.id,

            placeName:
                record.location
                    ?.placeName,

            latitude:
                record.location
                    ?.latitude,

            longitude:
                record.location
                    ?.longitude,
        },
    );

    return record;
}

/* ============================================================
 * GET RECORDINGS BY FOLDER
 * ============================================================ */

export async function getRecordingsByFolder(
    folderId: string,
): Promise<
    RecordingData[]
> {
    const all =
        await getAllRecordings();

    return all
        .filter(
            (recording) =>
                recording.folderId ===
                folderId,
        )
        .sort(
            (a, b) =>
                a.recordedAt.localeCompare(
                    b.recordedAt,
                ),
        );
}

/* ============================================================
 * GET ALL
 * ============================================================ */

export async function getAllRecordings(): Promise<
    RecordingData[]
> {
    const raw =
        await AsyncStorage.getItem(
            STORAGE_KEY,
        );

    if (!raw) {
        return [];
    }

    try {
        return JSON.parse(
            raw,
        ) as RecordingData[];
    } catch (error) {
        console.error(
            '[getAllRecordings] 파싱 실패:',
            error,
        );

        return [];
    }
}

/* ============================================================
 * DELETE
 * ============================================================ */

export async function deleteRecording(
    id: string,
): Promise<void> {
    const all =
        await getAllRecordings();

    const target =
        all.find(
            (recording) =>
                recording.id ===
                id,
        );

    if (target) {
        const info =
            await FileSystem.getInfoAsync(
                target.videoUri,
            );

        if (info.exists) {
            await FileSystem.deleteAsync(
                target.videoUri,
            );
        }
    }

    const filtered =
        all.filter(
            (recording) =>
                recording.id !==
                id,
        );

    await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
            filtered,
        ),
    );
}

/* ============================================================
 * CLEAR
 * ============================================================ */

export async function clearAllRecordings(): Promise<void> {
    const all =
        await getAllRecordings();

    for (const recording of all) {
        const info =
            await FileSystem.getInfoAsync(
                recording.videoUri,
            );

        if (info.exists) {
            await FileSystem.deleteAsync(
                recording.videoUri,
            );
        }
    }

    await AsyncStorage.removeItem(
        STORAGE_KEY,
    );
}