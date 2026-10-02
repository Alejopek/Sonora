import os
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.routes.music import router
from app.routes.account import router as account_router
from app.database import close_database, initialize_database

@asynccontextmanager
async def lifespan(_: FastAPI):
    await initialize_database()
    yield
    await close_database()

app = FastAPI(title='Sonora API', version='0.2.0', lifespan=lifespan)

frontend_origin = os.getenv('FRONTEND_ORIGIN', '*')
if frontend_origin == '*':
    origins = ['*']
else:
    origins = [origin.strip() for origin in frontend_origin.split(',')]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True if origins != ['*'] else False,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(router)
app.include_router(account_router)

@app.api_route('/health', methods=['GET', 'HEAD'])
def health():
    return {'status': 'ok'}

# Mount static files and SPA fallback
STATIC_DIR = Path(os.getenv('STATIC_DIR', Path(__file__).resolve().parent.parent / 'static'))

if STATIC_DIR.is_dir():
    assets_dir = STATIC_DIR / 'assets'
    if assets_dir.is_dir():
        app.mount('/assets', StaticFiles(directory=str(assets_dir)), name='assets')

    @app.api_route('/', methods=['GET', 'HEAD'])
    async def serve_root():
        index_file = STATIC_DIR / 'index.html'
        if index_file.is_file():
            return FileResponse(index_file)
        return {'status': 'ok', 'message': 'Frontend static files not found'}

    @app.api_route('/{full_path:path}', methods=['GET', 'HEAD'])
    async def serve_spa(full_path: str):
        if full_path.startswith('api/'):
            raise HTTPException(status_code=404, detail='Not Found')
        target = STATIC_DIR / full_path
        if full_path and target.is_file():
            return FileResponse(target)
        index_file = STATIC_DIR / 'index.html'
        if index_file.is_file():
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail='Frontend not found')
