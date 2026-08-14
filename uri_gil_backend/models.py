from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)
    nickname = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    region = Column(String)
    theme = Column(String)
    description = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    start_date = Column(Date)
    end_date = Column(Date)
    member_count = Column(Integer, default=1)
    clip_duration = Column(Integer, default=10)
    shooting_style = Column(String, default="기본 스타일")

class RouteSpot(Base):
    __tablename__ = "route_spots"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    spot_name = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    visit_order = Column(Integer, nullable=False)
    visited_at = Column(DateTime)

class Clip(Base):
    __tablename__ = "clips"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    spot_id = Column(Integer, ForeignKey("route_spots.id"), nullable=True)
    clip_url = Column(String, nullable=False)
    latitude = Column(Float)
    longitude = Column(Float)
    recorded_at = Column(DateTime)
    clip_order = Column(Integer)

class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    video_url = Column(String, nullable=False)
    thumbnail_url = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_public = Column(Boolean, default=True)