from pydantic import BaseModel, EmailStr
from datetime import datetime, date
from typing import Optional

# ========== 회원 ==========
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    nickname: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    nickname: str
    created_at: datetime

    class Config:
        from_attributes = True

# ========== 여정 ==========
class RouteCreate(BaseModel):
    title: str
    region: Optional[str] = None
    theme: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    member_count: Optional[int] = 1
    clip_duration: Optional[int] = 10
    shooting_style: Optional[str] = "기본 스타일"

class RouteResponse(BaseModel):
    id: int
    user_id: int
    title: str
    region: Optional[str]
    theme: Optional[str]
    description: Optional[str]
    start_date: Optional[date]
    end_date: Optional[date]
    member_count: Optional[int]
    clip_duration: Optional[int]
    shooting_style: Optional[str]
    created_at: datetime


    class Config:
        from_attributes = True

# ========== 클립 ==========
class ClipCreate(BaseModel):
    route_id: int
    spot_name: Optional[str] = None
    clip_url: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    recorded_at: Optional[datetime] = None
    clip_order: Optional[int] = None

class ClipResponse(BaseModel):
    id: int
    route_id: int
    user_id: int
    spot_id: Optional[int] = None
    clip_url: str
    clip_order: Optional[int]
    recorded_at: Optional[datetime]

    class Config:
        from_attributes = True

# ========== 영상 ==========
class VideoCreate(BaseModel):
    route_id: int
    video_url: str
    thumbnail_url: Optional[str] = None
    is_public: bool = True

class VideoResponse(BaseModel):
    id: int
    route_id: int
    user_id: int
    video_url: str
    thumbnail_url: Optional[str]
    is_public: bool
    created_at: datetime

    class Config:
        from_attributes = True

# ========== 장소 ==========
class RouteSpotCreate(BaseModel):
    route_id: int
    spot_name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    visit_order: int
    visited_at: Optional[datetime] = None

class RouteSpotResponse(BaseModel):
    id: int
    route_id: int
    spot_name: str
    latitude: Optional[float]
    longitude: Optional[float]
    visit_order: int
    visited_at: Optional[datetime]

    class Config:
        from_attributes = True