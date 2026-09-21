import os
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

CLIPS_BUCKET = "clips"

# 클립 업로드는 로그인한 사용자를 대신해 서버가 파일을 저장하는 동작이라
# service_role 키(RLS 우회)가 필요합니다 — .env의 SUPABASE_KEY(anon/publishable
# 키)로는 스토리지 정책을 따로 만들지 않는 한 업로드가 막힙니다.
_supabase: Client | None = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    _supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # 버킷이 없으면 앱이 뜰 때 자동으로 만듭니다. public=True로 만들어야 업로드된
    # 클립의 URL을 로그인 없이, 다른 기기에서도 바로 재생/다운로드할 수 있습니다.
    # 버킷이 이미 존재하면 create_bucket이 에러를 던지는데, 그 버킷이 (수동 생성 등
    # 다른 경로로) private였을 수 있어서 update_bucket으로 한 번 더 public 여부를
    # 강제해둡니다 — 안 그러면 업로드는 되는데 재생/다운로드가 권한 오류로 막힙니다.
    try:
        _supabase.storage.create_bucket(CLIPS_BUCKET, options={"public": True})
    except Exception:
        try:
            _supabase.storage.update_bucket(CLIPS_BUCKET, options={"public": True})
        except Exception:
            pass


def upload_clip_file(file_bytes: bytes, filename: str, content_type: str) -> str:
    if _supabase is None:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY가 설정되어 있지 않아 클립을 업로드할 수 없습니다"
        )

    _supabase.storage.from_(CLIPS_BUCKET).upload(
        filename,
        file_bytes,
        {"content-type": content_type, "upsert": "true"},
    )
    return _supabase.storage.from_(CLIPS_BUCKET).get_public_url(filename)
