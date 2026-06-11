"""PyInstaller entry point for the attribution engine sidecar."""
import argparse
import uvicorn


def main():
    parser = argparse.ArgumentParser(description="Attribution Engine Sidecar")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host")
    parser.add_argument("--port", type=int, default=8710, help="Bind port")
    args = parser.parse_args()

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
