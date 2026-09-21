import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db
from models import Clip, RouteSpot, User
from schemas import ClipCreate, ClipResponse
from routers.auth import get_current_user
from routers.spots import get_owned_route
from storage import upload_clip_file
from typing import List

router = APIRouter(prefix="/clips", tags=["clips"])

# 클립 영상 파일 자체를 Supabase Storage에 업로드하고 어디서든 접근 가능한
# URL을 돌려줍니다. 프론트는 촬영 직후 로컬 경로(file://, blob:)를 clip_url로
# 그대로 저장하는 대신, 먼저 이 엔드포인트로 업로드한 뒤 받은 URL을
# POST /clips/의 clip_url로 써야 다른 기기/브라우저에서도 클립이 재생됩니다.
@router.post("/upload")
async def upload_clip(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    ext = "mp4"
    if file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1]

    filename = f"{current_user.id}/{uuid.uuid4().hex}.{ext}"
    content = await file.read()
    url = upload_clip_file(content, filename, file.content_type or "video/mp4")

    return {"url": url}

@router.post("/", response_model=ClipResponse)
def create_clip(
    clip: ClipCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_route(clip.route_id, db, current_user)

    spot_id = None
    if clip.spot_name:
        # 같은 route 안에 같은 이름의 spot이 이미 있는지 확인
        existing_spot = (
            db.query(RouteSpot)
            .filter(RouteSpot.route_id == clip.route_id, RouteSpot.spot_name == clip.spot_name)
            .first()
        )
        if existing_spot:
            spot_id = existing_spot.id
        else:
            # 없으면 새로 생성
            spot_count = db.query(RouteSpot).filter(RouteSpot.route_id == clip.route_id).count()
            new_spot = RouteSpot(
                route_id=clip.route_id,
                spot_name=clip.spot_name,
                latitude=clip.latitude,
                longitude=clip.longitude,
                visit_order=spot_count + 1,
                visited_at=clip.recorded_at,
            )
            db.add(new_spot)
            db.commit()
            db.refresh(new_spot)
            spot_id = new_spot.id

    new_clip = Clip(
        route_id=clip.route_id,
        user_id=current_user.id,
        spot_id=spot_id,
        clip_url=clip.clip_url,
        latitude=clip.latitude,
        longitude=clip.longitude,
        recorded_at=clip.recorded_at,
        clip_order=clip.clip_order,
    )
    db.add(new_clip)
    db.commit()

    # 이미 있던 spot을 재사용한 경우, 방문 시간 최신화
    if spot_id and clip.recorded_at:
        spot = db.query(RouteSpot).filter(RouteSpot.id == spot_id).first()
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

    spot_id = clip.spot_id
    db.delete(clip)
    db.commit()

    # 이 스팟을 참조하던 마지막 클립이었다면(다른 클립이 더 없으면) 스팟도 같이 정리합니다.
    # 안 지우면 클립은 없는데 장소(RouteSpot)만 서버에 남아서, 다른 기기가 "이 기기엔
    # 없는 장소가 있다"고 착각하게 됩니다.
    if spot_id:
        remaining = db.query(Clip).filter(Clip.spot_id == spot_id).count()
        if remaining == 0:
            spot = db.query(RouteSpot).filter(RouteSpot.id == spot_id).first()
            if spot:
                db.delete(spot)
                db.commit()

    return {"message": "클립이 삭제됐습니다"}