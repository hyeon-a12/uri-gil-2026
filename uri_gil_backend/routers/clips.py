# 클립 API - 클립 업로드 / 여정별 클립 목록 조회 / 클립 삭제 
# clips = 여정 기준으로 조회

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Clip, RouteSpot
from schemas import ClipCreate, ClipResponse
from typing import List

router = APIRouter(prefix="/clips", tags=["clips"])

# 클립 업로드
@router.post("/", response_model=ClipResponse)
def create_clip(clip: ClipCreate, user_id: int, db: Session = Depends(get_db)):
    new_clip = Clip(
        route_id=clip.route_id,
        user_id=user_id,
        spot_id=clip.spot_id,
        clip_url=clip.clip_url,
        latitude=clip.latitude,
        longitude=clip.longitude,
        recorded_at=clip.recorded_at,
        clip_order=clip.clip_order
    )
    db.add(new_clip)
    db.commit()

    # 클립 촬영 시간을 spot의 visited_at에 자동 기록
    if clip.spot_id and clip.recorded_at:
        spot = db.query(RouteSpot).filter(RouteSpot.id == clip.spot_id).first()
        if spot:
            spot.visited_at = clip.recorded_at
            db.commit()

    db.refresh(new_clip)
    return new_clip

# 특정 여정의 클립 목록 조회
@router.get("/route/{route_id}", response_model=List[ClipResponse])
def get_clips(route_id: int, db: Session = Depends(get_db)):
    clips = db.query(Clip).filter(Clip.route_id == route_id).all()
    if not clips:
        raise HTTPException(status_code=404, detail="클립이 없습니다")
    return clips

# 클립 삭제
@router.delete("/{clip_id}")
def delete_clip(clip_id: int, db: Session = Depends(get_db)):
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="클립을 찾을 수 없습니다")
    db.delete(clip)
    db.commit()
    return {"message": "클립이 삭제됐습니다"}