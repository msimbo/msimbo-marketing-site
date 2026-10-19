import json, urllib.request, urllib.parse, sys, os
A=json.load(open(os.environ["SFAUTH"]))
V="/services/data/v60.0"
def call(method, path, body=None):
    url=A["instanceUrl"]+(path if path.startswith("/services") else V+path)
    req=urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization":"Bearer "+A["accessToken"],"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            t=r.read(); return json.loads(t) if t else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path}: {e.code} {e.read().decode()[:800]}")
def q(soql):
    r=call("GET","/query?q="+urllib.parse.quote(soql)); out=r["records"]
    while not r["done"]:
        r=call("GET",r["nextRecordsUrl"]); out+=r["records"]
    return out
def insert_many(obj, recs, size=200):
    ids=[]
    for i in range(0,len(recs),size):
        chunk=[dict(attributes={"type":obj},**x) for x in recs[i:i+size]]
        res=call("POST","/composite/sobjects",{"allOrNone":True,"records":chunk})
        for r in res:
            if not r["success"]: raise RuntimeError(r)
            ids.append(r["id"])
    return ids
def update_many(obj, recs):
    for i in range(0,len(recs),200):
        chunk=[dict(attributes={"type":obj},**x) for x in recs[i:i+200]]
        res=call("PATCH","/composite/sobjects",{"allOrNone":True,"records":chunk})
        for r in res:
            if not r["success"]: raise RuntimeError(r)
