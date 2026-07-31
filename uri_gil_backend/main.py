from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import auth, clips, videos, routes, spots

Base.metadata.create_all(bind=engine)

app = FastAPI(title="우리길 API")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 연결
app.include_router(auth.router)
app.include_router(clips.router)
app.include_router(videos.router)
app.include_router(routes.router)
app.include_router(spots.router)

@app.get("/")
def root():
    return {"message": "우리길 API 서버 정상 작동 중"}