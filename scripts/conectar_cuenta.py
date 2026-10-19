"""Conecta UNA cuenta de Google a Buzonero Campillero y guarda su refresh token.

Uso:  python conectar_cuenta.py <correo> [--puerto 3000] [--incognito]

Abre el navegador con la pantalla de consentimiento (con el correo como pista), recoge el
código en http://localhost:<puerto>/api/oauth/callback, lo cambia por tokens y comprueba la
cuenta con la API de Gmail. Guarda el token en ~/.config/buzonero/tokens/<correo>.json.
No imprime nunca ni el secreto ni los tokens ni el contenido de ningún mensaje.
"""
import json, os, secrets, sys, threading, urllib.parse, urllib.request, webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer

HOME = os.path.expanduser("~")
CFG = os.path.join(HOME, ".config", "buzonero")
CLIENTE = os.path.join(CFG, "google-oauth-client.json")
TOKENS = os.path.join(CFG, "tokens")
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.settings.basic",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/contacts.readonly",
    "https://www.googleapis.com/auth/contacts.other.readonly",
    "https://www.googleapis.com/auth/calendar",
]


def post(url, datos):
    req = urllib.request.Request(url, data=urllib.parse.urlencode(datos).encode(), method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def get(url, token):
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    correo = args[0].strip().lower()
    puerto = int(sys.argv[sys.argv.index("--puerto") + 1]) if "--puerto" in sys.argv else 3000
    c = json.load(open(CLIENTE, encoding="utf-8"))["web"]
    redirect = "http://localhost:%d/api/oauth/callback" % puerto
    if redirect not in c["redirect_uris"]:
        sys.exit("La redirección %s no está autorizada en el cliente de Google." % redirect)

    estado = secrets.token_urlsafe(24)
    resultado = {}

    class H(BaseHTTPRequestHandler):
        def do_GET(self):
            u = urllib.parse.urlparse(self.path)
            if u.path != "/api/oauth/callback":
                self.send_response(404); self.end_headers(); return
            q = urllib.parse.parse_qs(u.query)
            resultado.update({k: v[0] for k, v in q.items()})
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write("<meta charset=utf-8><body style='font:18px system-ui;padding:3rem'>"
                             "Listo. Ya puedes cerrar esta pestaña y volver a Claude.</body>".encode())
            threading.Thread(target=self.server.shutdown, daemon=True).start()

        def log_message(self, *a):
            pass

    srv = HTTPServer(("localhost", puerto), H)
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": c["client_id"], "redirect_uri": redirect, "response_type": "code",
        "scope": " ".join(SCOPES), "access_type": "offline", "prompt": "consent",
        "login_hint": correo, "state": estado,
    })
    print("Abriendo el navegador para:", correo, flush=True)
    chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    if "--incognito" in sys.argv and os.path.isfile(chrome):
        import subprocess
        subprocess.Popen([chrome, "--incognito", url])
    else:
        webbrowser.open(url)
    srv.timeout = 300
    srv.serve_forever()

    if resultado.get("state") != estado:
        sys.exit("Estado distinto: respuesta descartada.")
    if "error" in resultado:
        sys.exit("Google devolvió un error: %s" % resultado["error"])
    t = post("https://oauth2.googleapis.com/token", {
        "code": resultado["code"], "client_id": c["client_id"], "client_secret": c["client_secret"],
        "redirect_uri": redirect, "grant_type": "authorization_code"})
    if "refresh_token" not in t:
        sys.exit("Google no devolvió refresh_token. Revoca el acceso en myaccount.google.com/permissions y repite.")

    perfil = get("https://gmail.googleapis.com/gmail/v1/users/me/profile", t["access_token"])
    real = perfil["emailAddress"].lower()
    print("Cuenta conectada:", real, "| mensajes:", perfil.get("messagesTotal"), "| hilos:", perfil.get("threadsTotal"))
    if real != correo:
        print("AVISO: pediste %s pero entró %s. Se guarda con el correo real." % (correo, real))
    concedidos = sorted(t.get("scope", "").split())
    faltan = [s for s in SCOPES if s not in concedidos and s != "openid"]
    print("Permisos concedidos:", len(concedidos), "| sin conceder:", faltan or "ninguno")

    os.makedirs(TOKENS, exist_ok=True)
    ruta = os.path.join(TOKENS, real + ".json")
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump({"email": real, "refresh_token": t["refresh_token"], "scope": t.get("scope"),
                   "creado": __import__("datetime").datetime.now().isoformat(timespec="seconds")}, f, indent=2)
    print("Guardado en:", ruta.replace(HOME, "~"))


if __name__ == "__main__":
    main()
