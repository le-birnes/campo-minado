import subprocess, os, re, uuid, html, sys
HERE=os.path.dirname(os.path.abspath(__file__))
prof=os.path.join(HERE,'p_'+uuid.uuid4().hex[:6]); os.makedirs(prof)
args=[r"C:\Program Files\Google\Chrome\Application\chrome.exe","--headless=new","--disable-gpu",
      "--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-first-run","--no-sandbox",
      "--user-data-dir="+prof,"--virtual-time-budget=900000","--dump-dom",
      "file:///"+os.path.join(HERE,'bot_index.html').replace("\\","/")]
p=subprocess.run(args,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=3000)
m=re.search(r'data-r="([^"]*)"',p.stdout or '')
print(html.unescape(m.group(1)) if m else 'NO data-r (dom %d)'%len(p.stdout or ''))
