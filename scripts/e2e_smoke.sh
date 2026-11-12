#!/bin/bash
# SoulPlan e2e smoke: auth -> project -> sprint -> tasks -> dependency+409 -> board -> SSE realtime
BASE=${SOULPLAN_BASE:-http://localhost:3456}
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL: $1  ${2:0:120}"; }

# 1. register
R=$(curl -s --max-time 20 -X POST "$BASE/api/auth" -H 'Content-Type: application/json' \
  -d '{"action":"login","username":"e2e_user","password":"e2epass123"}')
TOK=$(echo "$R" | python3 -c 'import json,sys; print((json.load(sys.stdin).get("session") or {}).get("token",""))' 2>/dev/null)
if [ -n "$TOK" ]; then ok "register user (token len ${#TOK})"; else bad "register" "$R"; fi

# 2. session verify
V=$(curl -s --max-time 20 "$BASE/api/auth" -H "Authorization: Bearer $TOK")
echo "$V" | grep -q "e2e_user" && ok "session verify returns user" || bad "session verify" "$V"

# 3. create project
P=$(curl -s --max-time 20 -X POST "$BASE/api/projects" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"name":"E2E Board"}')
PID=$(echo "$P" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("project",d).get("id",""))' 2>/dev/null)
[ -n "$PID" ] && ok "create project ($PID)" || bad "create project" "$P"

# 4. fetch board
B=$(curl -s --max-time 20 "$BASE/api/board?projectId=$PID" -H "Authorization: Bearer $TOK")
BID=$(echo "$B" | python3 -c 'import json,sys; print(json.load(sys.stdin)["board"]["id"])' 2>/dev/null)
echo "$B" | grep -q '"releases"' && ok "board load" || bad "board load" "$B"

# 5. create release then sprint
RL=$(curl -s --max-time 20 -X POST "$BASE/api/releases" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d "{\"boardId\":\"$BID\",\"name\":\"E2E Release\",\"projectId\":\"$PID\"}")
RID=$(echo "$RL" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("release",d).get("id",""))' 2>/dev/null)
[ -n "$RID" ] && ok "create release" || bad "create release" "$RL"
S=$(curl -s --max-time 20 -X POST "$BASE/api/sprints" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d "{\"name\":\"E2E Sprint\",\"releaseId\":\"$RID\",\"position\":0,\"capacity\":10}")
SID=$(echo "$S" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("sprint",d).get("id",""))' 2>/dev/null)
[ -n "$SID" ] && ok "create sprint" || bad "create sprint" "$S"

# 6. create two tasks
T1=$(curl -s --max-time 20 -X POST "$BASE/api/tasks" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d "{\"title\":\"E2E task one\",\"sprintId\":\"$SID\",\"estimate\":3,\"color\":\"#3b82f6\",\"projectId\":\"$PID\"}")
TID1=$(echo "$T1" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("task",d).get("id",""))' 2>/dev/null)
T2=$(curl -s --max-time 20 -X POST "$BASE/api/tasks" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d "{\"title\":\"E2E task two\",\"sprintId\":\"$SID\",\"estimate\":2,\"color\":\"#ef4444\",\"projectId\":\"$PID\"}")
TID2=$(echo "$T2" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("task",d).get("id",""))' 2>/dev/null)
[ -n "$TID1" ] && [ -n "$TID2" ] && ok "create two tasks" || bad "create tasks" "$T1 $T2"

# 7. dependency + duplicate 409
D=$(curl -s --max-time 20 -X POST "$BASE/api/dependencies" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d "{\"fromTaskId\":\"$TID1\",\"toTaskId\":\"$TID2\",\"projectId\":\"$PID\"}")
D2=$(curl -s --max-time 20 -o /tmp/sp_dep2.json -w "%{http_code}" -X POST "$BASE/api/dependencies" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d "{\"fromTaskId\":\"$TID1\",\"toTaskId\":\"$TID2\",\"projectId\":\"$PID\"}")
echo "$D" | grep -q '"fromTaskId"\|"id"' && ! echo "$D" | grep -q '"error"' && ok "create dependency" || bad "create dependency" "$D"
[ "$D2" = "409" ] && ok "duplicate dependency -> 409" || bad "409 conflict" "got $D2"

# 8. burndown route (new on this merge)
BU=$(curl -s -L --max-time 20 -o /tmp/sp_bu.json -w "%{http_code}" "$BASE/api/sprints/$SID/burndown" -H "Authorization: Bearer $TOK")
[ "$BU" = "200" ] && ok "burndown route 200" || bad "burndown route" "got $BU"

# 9. Jira routes auth-gated (unauthenticated -> 401/403, authenticated -> configured:false)
JA=$(curl -s -L --max-time 20 -o /dev/null -w "%{http_code}" "$BASE/api/projects/$PID/jira/config")
JA2=$(curl -s -L --max-time 20 "$BASE/api/projects/$PID/jira/config" -H "Authorization: Bearer $TOK")
echo "$JA2" | grep -q "configured" && ok "jira config auth+shape" || bad "jira config" "$JA2"
[ "$JA" = "401" ] || [ "$JA" = "403" ] && ok "jira config unauthenticated blocked ($JA)" || bad "jira unauth" "got $JA"

# 10. SSE realtime: listen while sending presence+cursor
(curl -s -N --max-time 8 "$BASE/api/realtime/events?projectId=$PID&token=$TOK" > /tmp/sp_sse.txt 2>/dev/null) &
SSEPID=$!
sleep 1
curl -s --max-time 5 -X POST "$BASE/api/realtime/presence" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d "{\"projectId\":\"$PID\",\"action\":\"join\"}" > /dev/null
curl -s --max-time 5 -X POST "$BASE/api/realtime/cursor" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d "{\"projectId\":\"$PID\",\"x\":120,\"y\":80}" > /dev/null
wait $SSEPID 2>/dev/null
grep -q "presence\|cursor" /tmp/sp_sse.txt && ok "SSE stream carries presence/cursor events" || bad "SSE stream" "$(head -c 200 /tmp/sp_sse.txt)"

echo "=============================="
echo "SoulPlan e2e: $PASS passed, $FAIL failed"
