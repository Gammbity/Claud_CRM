#!/bin/bash
# BTEC C.M3 & D.M4 — Load Testing Script
# Tests CRM API performance under high load
# Compares: 1 backend vs 3 backends (load balanced)
#
# Requirements: Install k6 (https://k6.io) or use Apache Bench (ab)
# Windows: choco install k6  OR  use WSL2 with: sudo apt install apache2-utils

TARGET_URL="${1:-http://localhost}"
DURATION="${2:-30s}"
VIRTUAL_USERS="${3:-50}"

echo "======================================================"
echo " CRM Cloud Load Test — BTEC C.M3 / D.M4"
echo " Target: $TARGET_URL"
echo " Duration: $DURATION | Virtual Users: $VIRTUAL_USERS"
echo "======================================================"

# ─── Method 1: k6 (preferred — more detailed metrics) ───
if command -v k6 &> /dev/null; then
    echo ""
    echo "▶ Running k6 load test..."
    echo ""

    k6 run --vus "$VIRTUAL_USERS" --duration "$DURATION" - << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const backendInstances = new Counter('backend_instances_hit');
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');

// Track which backend instances are responding
const instanceCounts = {};

export const options = {
    thresholds: {
        http_req_duration: ['p(95)<500'],   // 95% of requests under 500ms
        error_rate: ['rate<0.05'],           // Error rate under 5%
    },
};

export default function () {
    const BASE_URL = __ENV.TARGET || 'http://localhost';

    // Test health endpoint (used by ALB health checks)
    const healthRes = http.get(`${BASE_URL}/api/health`);
    check(healthRes, {
        'health check 200': (r) => r.status === 200,
        'is healthy': (r) => JSON.parse(r.body).status === 'healthy',
    });

    const instance = healthRes.headers['X-Backend-Instance'];
    if (instance) {
        instanceCounts[instance] = (instanceCounts[instance] || 0) + 1;
    }

    responseTime.add(healthRes.timings.duration);
    errorRate.add(healthRes.status !== 200);

    sleep(0.1);
}

export function handleSummary(data) {
    console.log('\n=== LOAD BALANCING RESULTS ===');
    console.log('Requests per backend instance:');
    Object.entries(instanceCounts).forEach(([ip, count]) => {
        console.log(`  ${ip}: ${count} requests`);
    });
    console.log('\n=== PERFORMANCE SUMMARY ===');
    console.log(`Total requests: ${data.metrics.http_reqs.values.count}`);
    console.log(`Requests/sec:   ${data.metrics.http_reqs.values.rate.toFixed(1)}`);
    console.log(`P50 latency:    ${data.metrics.http_req_duration.values['p(50)'].toFixed(0)}ms`);
    console.log(`P95 latency:    ${data.metrics.http_req_duration.values['p(95)'].toFixed(0)}ms`);
    console.log(`P99 latency:    ${data.metrics.http_req_duration.values['p(99)'].toFixed(0)}ms`);
    console.log(`Error rate:     ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
    return {};
}
EOF

# ─── Method 2: Apache Bench (simpler — available on most systems) ───
elif command -v ab &> /dev/null; then
    echo ""
    echo "▶ Running Apache Bench load test..."
    echo ""
    REQUESTS=1000
    CONCURRENCY=50

    echo "─── Test 1: Health endpoint ───"
    ab -n $REQUESTS -c $CONCURRENCY -H "Accept: application/json" \
       "${TARGET_URL}/api/health" 2>&1 | grep -E "Requests per second|Time per request|Failed|Complete"

    echo ""
    echo "─── Test 2: 100 concurrent users ───"
    ab -n 2000 -c 100 -H "Accept: application/json" \
       "${TARGET_URL}/api/health" 2>&1 | grep -E "Requests per second|Time per request|Failed"

else
    # Fallback: simple curl loop test
    echo ""
    echo "▶ Running basic curl test (install k6 or ab for better results)..."
    echo ""
    INSTANCES=()
    for i in $(seq 1 20); do
        RESPONSE=$(curl -s -w "\n%{http_code}" "${TARGET_URL}/api/health" 2>/dev/null)
        HTTP_CODE=$(echo "$RESPONSE" | tail -1)
        INSTANCE=$(curl -sI "${TARGET_URL}/api/health" 2>/dev/null | grep -i "x-backend-instance" | awk '{print $2}' | tr -d '\r')

        if [ "$HTTP_CODE" = "200" ]; then
            echo "  Request $i: ✅ 200 OK — Backend: ${INSTANCE:-unknown}"
            [ -n "$INSTANCE" ] && INSTANCES+=("$INSTANCE")
        else
            echo "  Request $i: ❌ HTTP $HTTP_CODE"
        fi
    done

    echo ""
    echo "=== Backend instances that responded ==="
    printf '%s\n' "${INSTANCES[@]}" | sort | uniq -c | sort -rn
fi

echo ""
echo "======================================================"
echo " COMPARISON TABLE (fill in your results below)"
echo "======================================================"
echo ""
echo " | Metric              | 1 Backend | 3 Backends (LB) |"
echo " |---------------------|-----------|-----------------|"
echo " | Requests/sec        |     ?     |        ?        |"
echo " | P50 latency (ms)    |     ?     |        ?        |"
echo " | P95 latency (ms)    |     ?     |        ?        |"
echo " | Error rate          |     ?     |        ?        |"
echo " | Max concurrent      |     ?     |        ?        |"
echo ""
echo " HOW TO RUN:"
echo " 1. Single backend:    docker compose up"
echo "    ./scripts/load-test.sh http://localhost 30s 50"
echo ""
echo " 2. Load balanced:     docker compose -f docker-compose.yml \\"
echo "                         -f docker-compose.scale.yml up --scale backend=3"
echo "    ./scripts/load-test.sh http://localhost 30s 150"
echo ""
echo " Watch X-Backend-Instance header change between requests!"
echo "======================================================"
