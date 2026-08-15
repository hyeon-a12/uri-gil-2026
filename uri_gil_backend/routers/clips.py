from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Clip, RouteSpot, User
from schemas import ClipCreate, ClipResponse
from routers.auth import get_current_user
from routers.spots import get_owned_route
from typing import List

router = APIRouter(prefix="/clips", tags=["clips"])

@router.post("/", response_model=ClipResponse)
def create_clip(
    clip: ClipCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_route(clip.route_id, db, current_user)

    new_clip = Clip(
        route_id=clip.route_id,
        user_id=current_user.id,
        spot_id=clip.spot_id,
        clip_url=clip.clip_url,
        latitude=clip.latitude,
        longitude=clip.longitude,
        recorded_at=clip.recorded_at,
        clip_order=clip.clip_order,
    )
    db.add(new_clip)
    db.commit()

    if clip.spot_id and clip.recorded_at:
        spot = db.query(RouteSpot).filter(RouteSpot.id == clip.spot_id).first()
        if spot:
            spot.visited_at = clip.recorded_at
            db.commit()

    db.refresh(new_clip)
    return new_clip

@router.get("/route/{route_id}", response_model=List[ClipResponse])
def get_clips(
    route_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_route(route_id, db, current_user)
    clips = db.query(Clip).filter(Clip.route_id == route_id).all()
    return clips

@router.delete("/{clip_id}")
def delete_clip(
    clip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="클립을 찾을 수 없습니다")
    get_owned_route(clip.route_id, db, current_user)
    db.delete(clip)
    db.commit()
    return {"message": "클립이 삭제됐습니다"}