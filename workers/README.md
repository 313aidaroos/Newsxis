# Newsxis radio listener

Listens to the public radio / scanner streams in `sources` 24/7, transcribes them and posts transcript
segments to the site (`POST /api/worker/transcripts`), where Cixy turns them into stories.

## Run it (one small server, or the Oracle Cloud free tier)
```bash
sudo apt install -y ffmpeg          # Debian/Ubuntu
cd workers && npm install
export SITE_URL=https://newsxis.vercel.app
export WORKER_KEY=<same as WORKER_KEY in Vercel>
# cheapest: your own Whisper server (open source)
docker run -d -p 8000:8000 fedirz/faster-whisper-server:latest-cpu
export STT_PROVIDER=whisper WHISPER_URL=http://localhost:8000
# or pay-per-minute: export STT_PROVIDER=deepgram DEEPGRAM_API_KEY=...
export MAX_STREAMS=6                # Phase 1: NYC + national + a few world streams
npm run listen
```
Keep it alive with `pm2 start radio-listener.mjs --name newsxis-radio` or a systemd unit.

## Cost
- faster-whisper `small` on a 2-vCPU box keeps up with ~4–6 streams; `base` with more. ~$10–30/month total.
- Deepgram nova-3: ~$0.0043/min → ~$190 per station per month at 24/7. Use `ONLY=wnyc-fm,npr-news` to limit.

## Docker
```bash
docker build -t newsxis-radio . && docker run -d --env-file .env newsxis-radio
```
