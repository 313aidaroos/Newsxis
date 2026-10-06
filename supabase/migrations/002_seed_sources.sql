-- Newsxis · migration 002 · Phase-1 sources (free feeds + NYC public radio + world public broadcasters)
-- Stream URLs are the stations' public web streams. Check each station's terms before enabling `allows_transcript`.

insert into public.sources (kind, name, slug, url, stream_url, lang, country, region, city, county, lat, lng, poll_seconds, meta) values
-- NYC public radio (Phase 1 home city)
('radio','WNYC 93.9 FM','wnyc-fm','https://www.wnyc.org','https://fm939.wnyc.org/wnycfm','en','US','NY','New York','New York',40.7128,-74.0060,0,'{"owner":"New York Public Radio"}'),
('radio','WNYC AM 820','wnyc-am','https://www.wnyc.org','https://am820.wnyc.org/wnycam','en','US','NY','New York','New York',40.7128,-74.0060,0,'{"owner":"New York Public Radio"}'),
('radio','WBGO 88.3 Newark (NPR)','wbgo','https://www.wbgo.org','https://wbgo.streamguys1.com/wbgo128','en','US','NJ','Newark','Essex',40.7357,-74.1724,0,'{}'),
-- US national
('radio','NPR News (24h)','npr-news','https://www.npr.org','https://npr-ice.streamguys1.com/live.mp3','en','US',null,null,null,38.9072,-77.0369,0,'{"national":true}'),
-- World public broadcasters (English)
('radio','BBC World Service','bbc-world-service','https://www.bbc.co.uk/worldserviceradio','http://stream.live.vc.bbcmedia.co.uk/bbc_world_service','en','GB',null,'London',null,51.5074,-0.1278,0,'{"global":true}'),
('radio','Deutsche Welle (English)','dw-english','https://www.dw.com','https://dwstream4-lh.akamaihd.net/i/dwstream4_live@131329/master.m3u8','en','DE',null,'Bonn',null,50.7374,7.0982,0,'{"global":true}'),
('radio','ABC NewsRadio (Australia)','abc-newsradio','https://www.abc.net.au/newsradio','https://live-radio01.mediahubaustralia.com/PBW/mp3/','en','AU',null,'Sydney',null,-33.8688,151.2093,0,'{}'),
('radio','CBC Radio One Toronto','cbc-radio-one','https://www.cbc.ca/radio','https://cbcradiolive.cbc.ca/live/cbc_toronto.m3u8','en','CA','ON','Toronto',null,43.6532,-79.3832,0,'{}'),
('radio','Radio France Internationale (English)','rfi-english','https://www.rfi.fr/en','https://live02.rfi.fr/rfienglish-64.mp3','en','FR',null,'Paris',null,48.8566,2.3522,0,'{"global":true}'),
('radio','Radio Nacional de España (RNE)','rne','https://www.rtve.es/radio','https://rtvelivestream.akamaized.net/rtvesec/rne_r1_main.m3u8','es','ES',null,'Madrid',null,40.4168,-3.7038,0,'{}'),
-- RSS: world + regions (free)
('rss','BBC World','rss-bbc-world','https://feeds.bbci.co.uk/news/world/rss.xml',null,'en',null,null,null,null,null,null,180,'{}'),
('rss','Al Jazeera English','rss-aljazeera','https://www.aljazeera.com/xml/rss/all.xml',null,'en','QA',null,null,null,null,null,180,'{"regions":["ME","AF"]}'),
('rss','NPR News','rss-npr','https://feeds.npr.org/1001/rss.xml',null,'en','US',null,null,null,null,null,180,'{}'),
('rss','Deutsche Welle','rss-dw','https://rss.dw.com/rdf/rss-en-all',null,'en','DE',null,null,null,null,null,300,'{"regions":["EU","AF"]}'),
('rss','France 24','rss-france24','https://www.france24.com/en/rss',null,'en','FR',null,null,null,null,null,300,'{"regions":["EU","AF","ME"]}'),
('rss','The Guardian World','rss-guardian-world','https://www.theguardian.com/world/rss',null,'en','GB',null,null,null,null,null,300,'{}'),
('rss','Times of Israel','rss-toi','https://www.timesofisrael.com/feed/',null,'en','IL',null,null,null,null,null,300,'{"regions":["ME"]}'),
('rss','Arab News','rss-arabnews','https://www.arabnews.com/rss.xml',null,'en','SA',null,null,null,null,null,300,'{"regions":["ME"]}'),
('rss','Africanews','rss-africanews','https://www.africanews.com/feed/rss',null,'en',null,null,null,null,null,null,300,'{"regions":["AF"]}'),
('rss','Gothamist (NYC)','rss-gothamist','https://gothamist.com/feed',null,'en','US','NY','New York','New York',40.7128,-74.0060,300,'{}'),
('rss','NYC Emergency Management','rss-nycem','https://a858-nycnotify.nyc.gov/notifynyc/rss.aspx',null,'en','US','NY','New York','New York',40.7128,-74.0060,120,'{}'),
('rss','El País (Español)','rss-elpais','https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada',null,'es','ES',null,null,null,null,null,300,'{}'),
('rss','BBC Mundo (Español)','rss-bbc-mundo','https://feeds.bbci.co.uk/mundo/rss.xml',null,'es',null,null,null,null,null,null,300,'{}'),
-- Government alert feeds (free)
('gov','USGS Earthquakes M4.5+ (past day)','usgs-quakes','https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',null,'en',null,null,null,null,null,null,120,'{"format":"usgs"}'),
('gov','NWS Active Alerts (US)','nws-alerts','https://api.weather.gov/alerts/active?severity=Extreme,Severe',null,'en','US',null,null,null,null,null,120,'{"format":"nws"}'),
('gov','GDACS Global Disasters','gdacs','https://www.gdacs.org/xml/rss.xml',null,'en',null,null,null,null,null,null,300,'{"format":"gdacs"}'),
('gdelt','GDELT Global Conflict Events','gdelt-conflict','https://api.gdeltproject.org/api/v2/doc/doc?query=(war%20OR%20airstrike%20OR%20assassination%20OR%20bombing%20OR%20coup)%20sourcelang:english&mode=artlist&maxrecords=50&format=json&timespan=30min',null,'en',null,null,null,null,null,null,900,'{"format":"gdelt"}')
on conflict (slug) do nothing;
