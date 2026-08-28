from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Video, User
from schemas import VideoCreate, VideoResponse
from routers.auth import get_current_user
from routers.spots import get_owned_route
from typing import List

router = APIRouter(prefix="/videos", tags=["videos"])

@router.post("/", response_model=VideoResponse)
def create_video(
    video: VideoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_route(video.route_id, db, current_user)

    new_video = Video(
        route_id=video.route_id,
        user_id=current_user.id,
        video_url=video.video_url,
        thumbnail_url=video.thumbnail_url,
        is_public=video.is_public,
    )
    db.add(new_video)
    db.commit()
    db.refresh(new_video)
    return new_video

@router.get("/user/{user_id}", response_model=List[VideoResponse])
def get_user_videos(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인의 영상만 조회할 수 있습니다")
    videos = db.query(Video).filter(Video.user_id == user_id).all()
    return videos

@router.get("/route/{route_id}", response_model=VideoResponse)
def get_route_video(
    route_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_route(route_id, db, current_user)
    video = db.query(Video).filter(Video.route_id == route_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="영상이 없습니다")
    return video

@router.put("/{video_id}/visibility")
def update_visibility(
    video_id: int,
    is_public: bool,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다")
    if video.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인의 영상만 수정할 수 있습니다")
    video.is_public = is_public
    db.commit()
    db.refresh(video)
    return {"message": "공개 설정이 변경됐습니다", "is_public": video.is_public}

@router.delete("/{video_id}")
def delete_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다")
    if video.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인의 영상만 삭제할 수 있습니다")
    db.delete(video)
    db.commit()
    return {"message": "영상이 삭제됐습니다"}