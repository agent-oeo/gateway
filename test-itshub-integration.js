#!/usr/bin/env node

/**
 * Test script for ITS-Hub integration with Portkey Gateway
 *
 * Prerequisites:
 * - ITS-Hub server running on http://localhost:8108
 * - Portkey Gateway running on http://localhost:8787
 *
 * Usage: node test-itshub-integration.js
 */

import http from 'http';

const ITSHUB_URL = 'http://localhost:8108';
const PORTKEY_URL = 'http://localhost:8787';
const TEST_BUDGET = 2;
const TEST_MODEL = 'gpt-4.1';
const TEST_QUESTION = 'what is the capital of england';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(responseData)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: responseData
          });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function testDirectITSHub() {
  log('\n' + '='.repeat(60), colors.cyan);
  log('TEST 1: Direct ITS-Hub Endpoint', colors.bright + colors.cyan);
  log('='.repeat(60), colors.cyan);

  const data = JSON.stringify({
    model: TEST_MODEL,
    messages: [{ role: 'user', content: TEST_QUESTION }],
    budget: TEST_BUDGET
  });

  const options = {
    hostname: 'localhost',
    port: 8108,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  try {
    log(`\nRequest URL: ${ITSHUB_URL}/v1/chat/completions`, colors.blue);
    log(`Budget: ${TEST_BUDGET}`, colors.blue);
    log(`Model: ${TEST_MODEL}`, colors.blue);
    log(`Question: "${TEST_QUESTION}"`, colors.blue);

    const response = await makeRequest(options, data);

    if (response.statusCode === 200) {
      log('\n✅ SUCCESS', colors.green);
      log(`Status: ${response.statusCode}`, colors.green);

      if (response.data.choices && response.data.choices[0]) {
        log(`\nResponse:`, colors.yellow);
        log(response.data.choices[0].message.content, colors.reset);
      }

      return { success: true, response: response.data };
    } else {
      log(`\n❌ FAILED - Status: ${response.statusCode}`, colors.red);
      log(JSON.stringify(response.data, null, 2), colors.red);
      return { success: false, response: response.data };
    }
  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, colors.red);
    log('Make sure ITS-Hub is running on http://localhost:8108', colors.yellow);
    return { success: false, error: error.message };
  }
}

async function testThroughPortkey() {
  log('\n' + '='.repeat(60), colors.cyan);
  log('TEST 2: ITS-Hub Through Portkey Gateway', colors.bright + colors.cyan);
  log('='.repeat(60), colors.cyan);

  const config = JSON.stringify({
    provider: "openai",
    api_key: "dummy-key",
    custom_host: "http://localhost:8108/v1",
    inputMutators: [{
      "custom.itsHub": {
        budget: TEST_BUDGET
      }
    }]
  });

  const data = JSON.stringify({
    model: TEST_MODEL,
    messages: [{ role: 'user', content: TEST_QUESTION }]
  });

  const options = {
    hostname: 'localhost',
    port: 8787,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-portkey-config': config,
      'Content-Length': data.length
    }
  };

  try {
    log(`\nRequest URL: ${PORTKEY_URL}/v1/chat/completions`, colors.blue);
    log(`Custom Host: http://localhost:8108/v1`, colors.blue);
    log(`Plugin: custom.itsHub`, colors.blue);
    log(`Budget: ${TEST_BUDGET}`, colors.blue);
    log(`Model: ${TEST_MODEL}`, colors.blue);
    log(`Question: "${TEST_QUESTION}"`, colors.blue);

    const response = await makeRequest(options, data);

    if (response.statusCode === 200) {
      log('\n✅ SUCCESS', colors.green);
      log(`Status: ${response.statusCode}`, colors.green);

      if (response.data.choices && response.data.choices[0]) {
        log(`\nResponse:`, colors.yellow);
        log(response.data.choices[0].message.content, colors.reset);
      }

      // Check plugin execution
      if (response.data.hook_results && response.data.hook_results.before_request_hooks) {
        const itsHubHook = response.data.hook_results.before_request_hooks[0];
        if (itsHubHook && itsHubHook.checks) {
          const itsHubCheck = itsHubHook.checks.find(c => c.id === 'custom.itsHub');
          if (itsHubCheck) {
            log(`\n✅ Plugin Executed:`, colors.green);
            log(`   ID: ${itsHubCheck.id}`, colors.green);
            log(`   Budget Added: ${itsHubCheck.data.budget}`, colors.green);
            log(`   Transformed: ${itsHubCheck.transformed}`, colors.green);
            log(`   Execution Time: ${itsHubCheck.execution_time}ms`, colors.green);
          }
        }
      }

      return { success: true, response: response.data };
    } else {
      log(`\n❌ FAILED - Status: ${response.statusCode}`, colors.red);
      log(JSON.stringify(response.data, null, 2), colors.red);
      return { success: false, response: response.data };
    }
  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, colors.red);
    log('Make sure Portkey Gateway is running on http://localhost:8787', colors.yellow);
    return { success: false, error: error.message };
  }
}


async function main() {
  log('\n' + '█'.repeat(60), colors.bright + colors.cyan);
  log('  ITS-Hub + Portkey Gateway Integration Test', colors.bright + colors.cyan);
  log('█'.repeat(60) + '\n', colors.bright + colors.cyan);

  // Test 1: Direct ITS-Hub
  const directResult = await testDirectITSHub();

  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Through Portkey
  const portkeyResult = await testThroughPortkey();

  // Summary
  log('\n' + '='.repeat(60), colors.cyan);
  log('SUMMARY', colors.bright + colors.cyan);
  log('='.repeat(60), colors.cyan);

  const test1Status = directResult.success ? '✅ PASS' : '❌ FAIL';
  const test2Status = portkeyResult.success ? '✅ PASS' : '❌ FAIL';
  const test1Color = directResult.success ? colors.green : colors.red;
  const test2Color = portkeyResult.success ? colors.green : colors.red;

  log(`\nTest 1 (Direct ITS-Hub):     ${test1Status}`, test1Color);
  log(`Test 2 (Through Portkey):    ${test2Status}`, test2Color);

  if (directResult.success && portkeyResult.success) {
    log(`\n${'🎉'.repeat(20)}`, colors.bright + colors.green);
    log('ALL TESTS PASSED! Integration is working perfectly!', colors.bright + colors.green);
    log('🎉'.repeat(20) + '\n', colors.bright + colors.green);
    process.exit(0);
  } else {
    log(`\n⚠️  Some tests failed. Please check the output above.`, colors.yellow);
    log('\nTroubleshooting:', colors.yellow);
    if (!directResult.success) {
      log('- Ensure ITS-Hub is running: npm run iaas-start (or equivalent)', colors.yellow);
    }
    if (!portkeyResult.success) {
      log('- Ensure Portkey Gateway is running: npm run dev:node', colors.yellow);
      log('- Ensure plugins are built: npm run build-plugins', colors.yellow);
    }
    log('');
    process.exit(1);
  }
}

// Run tests
main().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
