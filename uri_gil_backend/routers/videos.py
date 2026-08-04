# 비디오 API - 영상 저장 / 영상 목록 조회 / 여정별 영상 조회 / 공개 범위 설정 / 영상 삭제
# videos = 유저 기준 or 여정 기준으로 조회

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Video
from schemas import VideoCreate, VideoResponse
from typing import List

router = APIRouter(prefix="/videos", tags=["videos"])

# 영상 저장
@router.post("/", response_model=VideoResponse)
def create_video(video: VideoCreate, user_id: int, db: Session = Depends(get_db)):
    new_video = Video(
        route_id=video.route_id,
        user_id=user_id,
        video_url=video.video_url,
        thumbnail_url=video.thumbnail_url,
        is_public=video.is_public
    )
    db.add(new_video)
    db.commit()
    db.refresh(new_video)
    return new_video

# 특정 유저의 영상 목록 조회 (프로필)
@router.get("/user/{user_id}", response_model=List[VideoResponse])
def get_user_videos(user_id: int, db: Session = Depends(get_db)):
    videos = db.query(Video).filter(Video.user_id == user_id).all()
    if not videos:
        raise HTTPException(status_code=404, detail="영상이 없습니다")
    return videos

# 특정 여정의 영상 조회
@router.get("/route/{route_id}", response_model=VideoResponse)
def get_route_video(route_id: int, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.route_id == route_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="영상이 없습니다")
    return video

# 공개/비공개 설정
@router.put("/{video_id}/visibility")
def update_visibility(video_id: int, is_public: bool, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다")
    video.is_public = is_public
    db.commit()
    db.refresh(video)
    return {"message": "공개 설정이 변경됐습니다", "is_public": video.is_public}

# 영상 삭제
@router.delete("/{video_id}")
def delete_video(video_id: int, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다")
    db.delete(video)
    db.commit()
    return {"message": "영상이 삭제됐습니다"}