# OmniRoute origin deployment

This container runs the real `omniroute@3.8.50` engine. A minimal ingress exposes only:

- `GET /healthz` (forwarded to OmniRoute `/api/health`)
- `GET /v1/models`
- `POST /v1/chat/completions` (streaming is passed through)

The ingress contains no model selection, provider routing, retry, fallback, quota, or cost logic. All of those remain inside OmniRoute. Dashboard, management, auth, and debug routes are not exposed by the public listener.

## Required platform configuration

- Persistent volume mounted at `/var/lib/omniroute`
- `STORAGE_ENCRYPTION_KEY`: secret, at least 32 characters; retain it with the volume
- `ORIGIN_SHARED_SECRET`: dedicated Worker-to-origin secret; configure the same value as the Worker's `OMNIROUTE_ORIGIN_TOKEN`
- `OMNIROUTE_API_KEY`: separate ingress-to-OmniRoute runtime credential; never reuse an end-user gateway key
- `PORT`: supplied by the hosting platform (defaults to `8080`)
- At least one real provider credential configured in the persistent OmniRoute data store before inference can pass

Do not bake `.env`, SQLite data, provider credentials, or Cloudflare state into the image.

## Build and run

```sh
docker build -f Dockerfile.omniroute-origin -t omniroute-origin:3.8.50 .
docker run --rm -p 8080:8080 \
  -v omniroute-data:/var/lib/omniroute \
  -e STORAGE_ENCRYPTION_KEY \
  -e ORIGIN_SHARED_SECRET \
  -e OMNIROUTE_API_KEY \
  omniroute-origin:3.8.50
```

The hosting platform must terminate public HTTPS and forward to `PORT`. Configure the Worker only after the HTTPS origin passes direct health, authenticated models, authenticated chat, streaming, and negative-route checks.
