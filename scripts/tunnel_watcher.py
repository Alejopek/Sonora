#!/usr/bin/env python3
"""
Tunnel Watcher for Sonora
Monitors cloudflared quick tunnel logs, automatically updates Uptime Kuma monitor URL,
and notifies via Telegram using the configured Uptime Kuma bot.
"""

import http.client
import json
import os
import re
import socket
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime


def log(msg: str):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {msg}", flush=True)


class UnixHTTPConnection(http.client.HTTPConnection):
    def __init__(self, unix_socket_path: str, timeout: float = 10.0):
        super().__init__("localhost", timeout=timeout)
        self.unix_socket_path = unix_socket_path

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(self.unix_socket_path)


def docker_request(method: str, path: str, body: bytes | None = None, timeout: float = 10.0) -> tuple[int, bytes]:
    sock_path = os.environ.get("DOCKER_SOCK", "/var/run/docker.sock")
    conn = UnixHTTPConnection(sock_path, timeout=timeout)
    try:
        headers = {}
        if body:
            headers["Content-Type"] = "application/json"
            headers["Content-Length"] = str(len(body))
        conn.request(method, path, body=body, headers=headers)
        res = conn.getresponse()
        data = res.read()
        return res.status, data
    finally:
        conn.close()


def get_db_path() -> str:
    candidates = [
        os.environ.get("KUMA_DB_PATH", ""),
        "/kuma-data/kuma.db",
        "/home/server-ale/appa/uptime-kuma/uptime-kuma-data/kuma.db",
    ]
    for path in candidates:
        if path and os.path.exists(path):
            return path
    raise FileNotFoundError("No se encontró kuma.db en ninguna de las rutas esperadas.")


def get_telegram_creds(db_path: str) -> tuple[str, str]:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()

    if token and chat_id:
        return token, chat_id

    # Fallback to reading from Uptime Kuma SQLite database
    try:
        with sqlite3.connect(db_path, timeout=5.0) as conn:
            cur = conn.cursor()
            cur.execute("SELECT config FROM notification")
            for row in cur.fetchall():
                if row and row[0]:
                    try:
                        cfg = json.loads(row[0])
                        if cfg.get("type") == "telegram":
                            if not token:
                                token = str(cfg.get("telegramBotToken", "")).strip()
                            if not chat_id:
                                chat_id = str(cfg.get("telegramChatID", "")).strip()
                            if token and chat_id:
                                break
                    except Exception:
                        pass
    except Exception as e:
        log(f"Aviso: No se pudieron leer credenciales de Telegram desde kuma.db: {e}")

    return token, chat_id


def get_github_token() -> str:
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if token:
        return token
    candidates = [
        "/gh-config/hosts.yml",
        os.path.expanduser("~/.config/gh/hosts.yml"),
        "/home/server-ale/.config/gh/hosts.yml",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        if "oauth_token:" in line:
                            val = line.split("oauth_token:", 1)[1].strip()
                            if val:
                                return val
            except Exception as e:
                log(f"Aviso leyendo {path}: {e}")
    return ""


def update_github_homepage(repo: str, new_url: str, token: str) -> bool:
    if not token or not repo:
        return False
    try:
        url = f"https://api.github.com/repos/{repo}"
        data = json.dumps({"homepage": new_url}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "User-Agent": "Sonora-Tunnel-Watcher",
            },
            method="PATCH",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                log(f"GitHub repository '{repo}' homepage actualizada a: {new_url}")
                return True
    except Exception as e:
        log(f"Error actualizando homepage en GitHub ({repo}): {e}")
    return False


def send_telegram(token: str, chat_id: str, message: str) -> bool:
    if not token or not chat_id:
        log("No hay credenciales de Telegram configuradas, omitiendo envío de mensaje.")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown",
        "disable_web_page_preview": "false",
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return bool(data.get("ok"))
    except Exception as e:
        log(f"Error enviando mensaje de Telegram: {e}")
        return False


def get_latest_tunnel_url(tunnel_container: str) -> str | None:
    try:
        status, data = docker_request("GET", f"/containers/{tunnel_container}/logs?stdout=1&stderr=1&tail=100")
        if status != 200:
            return None
        logs = data.decode("utf-8", errors="replace")
        matches = re.findall(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", logs)
        if matches:
            return matches[-1]
    except Exception as e:
        log(f"Error consultando logs de {tunnel_container}: {e}")
    return None


def get_kuma_monitor(db_path: str, monitor_name: str) -> tuple[int, str] | None:
    try:
        with sqlite3.connect(db_path, timeout=5.0) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, url FROM monitor WHERE name = ? LIMIT 1", (monitor_name,))
            row = cur.fetchone()
            if row:
                return row[0], (row[1] or "")
    except Exception as e:
        log(f"Error consultando monitor '{monitor_name}' en kuma.db: {e}")
    return None


def update_kuma_monitor(db_path: str, monitor_id: int, new_url: str) -> bool:
    try:
        with sqlite3.connect(db_path, timeout=10.0) as conn:
            cur = conn.cursor()
            # Ensure proper URL formatting
            formatted_url = new_url if new_url.endswith("/") else f"{new_url}/"
            cur.execute("UPDATE monitor SET url = ? WHERE id = ?", (formatted_url, monitor_id))
            conn.commit()
            log(f"Monitor ID {monitor_id} actualizado en kuma.db con nueva URL: {formatted_url}")
            return True
    except Exception as e:
        log(f"Error actualizando kuma.db: {e}")
        return False


def restart_kuma(kuma_container: str) -> bool:
    try:
        log(f"Reiniciando contenedor '{kuma_container}' para aplicar la nueva URL...")
        status, _ = docker_request("POST", f"/containers/{kuma_container}/restart?t=5")
        if status in (204, 200):
            log(f"Contenedor '{kuma_container}' reiniciado con éxito.")
            return True
        else:
            log(f"Respuesta inesperada al reiniciar {kuma_container}: {status}")
    except Exception as e:
        log(f"Error reiniciando {kuma_container}: {e}")
    return False


def main():
    log("Iniciando Sonora Tunnel Watcher...")

    tunnel_container = os.environ.get("TUNNEL_CONTAINER", "sonora-tunnel")
    kuma_container = os.environ.get("UPTIME_KUMA_CONTAINER", "uptime-kuma")
    monitor_name = os.environ.get("MONITOR_NAME", "Sonora")
    poll_interval = int(os.environ.get("POLL_INTERVAL", "5"))

    try:
        db_path = get_db_path()
        log(f"Base de datos de Uptime Kuma detectada: {db_path}")
    except Exception as e:
        log(f"Error fatal: {e}")
        sys.exit(1)

    token, chat_id = get_telegram_creds(db_path)
    if token and chat_id:
        log(f"Credenciales de Telegram cargadas (Chat ID: {chat_id})")
    else:
        log("Aviso: No se encontraron credenciales de Telegram.")

    github_repo = os.environ.get("GITHUB_REPO", "Alejopek/Sonora").strip()
    github_token = get_github_token()
    if github_token:
        log(f"Token de GitHub cargado para el repositorio: {github_repo}")
    else:
        log("Aviso: No se encontró token de GitHub.")

    last_known_url: str | None = None

    while True:
        try:
            latest_url = get_latest_tunnel_url(tunnel_container)
            if latest_url:
                clean_latest = latest_url.rstrip("/")
                monitor_info = get_kuma_monitor(db_path, monitor_name)

                kuma_url = monitor_info[1].rstrip("/") if monitor_info else ""
                monitor_id = monitor_info[0] if monitor_info else None

                # Si es la primera vez que corre, inicializamos con lo que esté en Kuma o el túnel
                if last_known_url is None:
                    last_known_url = kuma_url or clean_latest
                    log(f"Estado inicial -> URL conocida: {last_known_url}")

                # Si detectamos que la URL del túnel cambió respecto a la conocida o a la de Kuma
                if clean_latest != last_known_url or (kuma_url and clean_latest != kuma_url):
                    log(f"¡Nueva URL detectada para Sonora! {clean_latest}")

                    # 1. Actualizar Uptime Kuma
                    if monitor_id is not None:
                        if update_kuma_monitor(db_path, monitor_id, clean_latest):
                            restart_kuma(kuma_container)
                    else:
                        log(f"Aviso: No se encontró el monitor '{monitor_name}' en Uptime Kuma.")

                    # 2. Actualizar Website (homepage) en GitHub
                    gh_updated = False
                    if github_token and github_repo:
                        gh_updated = update_github_homepage(github_repo, clean_latest, github_token)

                    # 3. Notificar por Telegram
                    status_line = "✅ _Uptime Kuma y GitHub actualizados automáticamente._" if gh_updated else "✅ _Uptime Kuma actualizado automáticamente._"
                    msg = (
                        "🎵 *Sonora — Nueva URL del Túnel*\n\n"
                        f"🔗 {clean_latest}\n\n"
                        f"{status_line}"
                    )
                    if send_telegram(token, chat_id, msg):
                        log("Notificación enviada por Telegram exitosamente.")

                    last_known_url = clean_latest

        except Exception as e:
            log(f"Error inesperado en el bucle principal: {e}")

        time.sleep(poll_interval)


if __name__ == "__main__":
    main()
