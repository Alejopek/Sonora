import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.music import router

load_dotenv()
app = FastAPI(title='Sonora API', version='0.1.0')
origins = [origin.strip() for origin in os.getenv('FRONTEND_ORIGIN', 'http://localhost:5173,http://127.0.0.1:5173').split(',')]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=['GET'], allow_headers=['*'])
app.include_router(router)

@app.get('/health')
def health(): return {'status': 'ok'}
