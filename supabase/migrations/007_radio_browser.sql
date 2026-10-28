-- Newsxis · migration 007 · browser-playable radio streams
-- Apply after 006. Does not edit 001–006. Safe to re-run: each statement sets the same row.
-- Checked 2026-10-28 against the live URLs. The site player is a plain audio element,
-- so a stream has to be https and audio/mpeg or audio/aac. HLS and http-on-https are not offered.
-- Dead mounts are turned off. The worker only listens to active streams, and these URLs
-- were already failing (404, DNS, or HTTP 400), so turning them off does not drop a working feed.

update public.sources
set stream_url = 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service'
where slug = 'bbc-world-service'
  and stream_url is distinct from 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service';

update public.sources
set stream_url = 'https://ais-sa8.cdnstream1.com/3629_128.mp3'
where slug = 'wbgo'
  and stream_url is distinct from 'https://ais-sa8.cdnstream1.com/3629_128.mp3';

update public.sources
set stream_url = 'https://abc.streamguys1.com/live/newsradio/icecast.audio'
where slug = 'abc-newsradio'
  and stream_url is distinct from 'https://abc.streamguys1.com/live/newsradio/icecast.audio';

update public.sources
set stream_url = 'https://rfienanglais64k.ice.infomaniak.ch/rfienanglais-64.mp3'
where slug = 'rfi-english'
  and stream_url is distinct from 'https://rfienanglais64k.ice.infomaniak.ch/rfienanglais-64.mp3';

-- WNYC AM mounts 404. DW's HLS URL returns 400. CBC's host does not resolve.
-- RNE's host does not resolve. The replacements that answer are HLS, which this player cannot play.
update public.sources
set active = false,
    meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('browser', 'disabled', 'reason', 'no https stream a browser audio element can play')
where slug in ('wnyc-am', 'dw-english', 'cbc-radio-one', 'rne')
  and active is distinct from false;
