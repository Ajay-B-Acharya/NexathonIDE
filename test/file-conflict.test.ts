import assert from 'assert';
import {
  generateAlternativeName,
  normalizeWorkspacePath,
  extractParentAndName,
} from '../src/utils/fileConflictUtils.ts';

const API_BASE = 'http://localhost:3001';

async function postJson(endpoint: string, body: any, headers: Record<string, string> = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

async function getJson(endpoint: string) {
  const res = await fetch(`${API_BASE}${endpoint}`);
  const data = await res.json();
  return { status: res.status, data };
}

async function runTests() {
  const nonce = Date.now();
  console.log(`\n================================================================`);
  console.log(`🚀 STARTING SMART CONFLICT RESOLUTION TEST SUITE (Nonce: ${nonce})`);
  console.log(`================================================================\n`);

  // --- UNIT TESTS: Path Utilities & Alternative Name Generation ---
  console.log('📌 Test 1: Alternative Name Generation & Extension Rules...');
  assert.strictEqual(generateAlternativeName('main.py', []), 'main-1.py');
  assert.strictEqual(generateAlternativeName('utils.ts', []), 'utils-1.ts');
  assert.strictEqual(generateAlternativeName('README.md', []), 'README-1.md');
  assert.strictEqual(generateAlternativeName('components', []), 'components-1');
  assert.strictEqual(generateAlternativeName('main.py', ['main-1.py']), 'main-2.py');
  assert.strictEqual(generateAlternativeName('main-1.py', []), 'main-2.py');
  assert.strictEqual(generateAlternativeName('main-1.py', ['main-2.py']), 'main-3.py');
  assert.strictEqual(generateAlternativeName('.gitignore', []), '.gitignore-1');

  // Test normalization & parent/name extraction
  assert.strictEqual(normalizeWorkspacePath('/src//utils/math.ts/'), 'src/utils/math.ts');
  assert.throws(() => normalizeWorkspacePath('../../secret.txt'), /directory traversal/);
  const split1 = extractParentAndName('src/components/Header.tsx');
  assert.strictEqual(split1.parentPath, 'src/components');
  assert.strictEqual(split1.fileName, 'Header.tsx');
  const split2 = extractParentAndName('main.py');
  assert.strictEqual(split2.parentPath, '');
  assert.strictEqual(split2.fileName, 'main.py');
  console.log('✅ Test 1 PASSED: Path utilities and naming conventions validated.');

  // --- INTEGRATION TESTS: Demo Workspace (In-Memory Isolation) ---
  const demoRoomId = `room_demo_concurrent_${nonce}`;
  console.log(`\n📌 Test 2: Concurrent File Creation in Demo Workspace (${demoRoomId})...`);

  // Simulate two collaborators submitting 'app.py' simultaneously
  const clientA_Promise = postJson(`/rooms/${demoRoomId}/files`, {
    path: 'app.py',
    content: 'print("Hello from Client A")',
    idempotencyKey: `idem_a_${nonce}`,
  });
  const clientB_Promise = postJson(`/rooms/${demoRoomId}/files`, {
    path: 'app.py',
    content: 'print("Hello from Client B - Unsaved Draft")',
    idempotencyKey: `idem_b_${nonce}`,
  });

  const [resA, resB] = await Promise.all([clientA_Promise, clientB_Promise]);

  const winner = resA.status === 201 ? resA : resB;
  const loser = resA.status === 409 ? resA : resB;

  assert.strictEqual(winner.status, 201, 'One request must succeed with 201 Created');
  assert.strictEqual(loser.status, 409, 'Concurrent request must be rejected with 409 Conflict');
  assert.strictEqual(loser.data.code, 'CONFLICT_EXISTS', 'Conflict response code must be CONFLICT_EXISTS');
  assert.strictEqual(loser.data.conflict.path, 'app.py');
  assert.strictEqual(loser.data.conflict.type, 'file');

  // Verify existing file content was NOT overwritten by the loser
  const filesRes = await getJson(`/rooms/${demoRoomId}/files`);
  const existingAppFile = filesRes.data.find((f: any) => f.path === 'app.py');
  assert.ok(existingAppFile, 'app.py must exist in file list');
  assert.strictEqual(existingAppFile.content, winner.data.content, 'Winner content must be intact and not overwritten');
  console.log('✅ Test 2 PASSED: Exactly 1 winner (201) and 1 loser (409). Winner content preserved.');

  // --- TEST 3: Safe Retries & Idempotency ---
  console.log('\n📌 Test 3: Safe Retries with Idempotency Key...');
  // Winner retries exact request due to network delay or double click
  const retryWinner = await postJson(`/rooms/${demoRoomId}/files`, {
    path: 'app.py',
    content: winner.data.content,
    idempotencyKey: winner === resA ? `idem_a_${nonce}` : `idem_b_${nonce}`,
  });
  assert.strictEqual(retryWinner.status, 201, 'Retry with matching idempotencyKey must return cached success');
  assert.strictEqual(retryWinner.data.id, winner.data.id, 'Must return same file ID without creating duplicates');

  const filesAfterRetry = await getJson(`/rooms/${demoRoomId}/files`);
  const appFileCount = filesAfterRetry.data.filter((f: any) => f.path === 'app.py').length;
  assert.strictEqual(appFileCount, 1, 'File tree must contain exactly 1 entry for app.py');
  console.log('✅ Test 3 PASSED: Idempotent retries return cached result without duplicate file creation.');

  // --- TEST 4: Loser Creates Alternative Copy ---
  console.log('\n📌 Test 4: Loser Creates Copy with Draft Content Preserved...');
  const suggestedName = generateAlternativeName('app.py', ['app.py']);
  assert.strictEqual(suggestedName, 'app-1.py');

  const copyRes = await postJson(`/rooms/${demoRoomId}/files`, {
    path: suggestedName,
    content: 'print("Hello from Client B - Unsaved Draft")',
    idempotencyKey: `idem_copy_${nonce}`,
  });
  assert.strictEqual(copyRes.status, 201, 'Creating suggested alternative copy must succeed');
  assert.strictEqual(copyRes.data.content, 'print("Hello from Client B - Unsaved Draft")', 'Draft content must be transferred intact');

  const updatedFiles = await getJson(`/rooms/${demoRoomId}/files`);
  assert.ok(updatedFiles.data.some((f: any) => f.path === 'app.py'), 'Original file must remain');
  assert.ok(updatedFiles.data.some((f: any) => f.path === 'app-1.py'), 'Copy file must exist');
  console.log('✅ Test 4 PASSED: Loser created copy app-1.py with draft content intact.');

  // --- TEST 5: Concurrent Folder Creation ---
  console.log('\n📌 Test 5: Concurrent Folder Creation...');
  const folderA_Promise = postJson(`/rooms/${demoRoomId}/files`, {
    path: 'components/.gitkeep',
    content: '',
    idempotencyKey: `idem_fold_a_${nonce}`,
  });
  const folderB_Promise = postJson(`/rooms/${demoRoomId}/files`, {
    path: 'components/.gitkeep',
    content: '',
    idempotencyKey: `idem_fold_b_${nonce}`,
  });

  const [fResA, fResB] = await Promise.all([folderA_Promise, folderB_Promise]);
  const fWinner = fResA.status === 201 ? fResA : fResB;
  const fLoser = fResA.status === 409 ? fResA : fResB;

  assert.strictEqual(fWinner.status, 201, 'One folder creation must succeed');
  assert.strictEqual(fLoser.status, 409, 'Concurrent folder creation must be rejected with 409');
  assert.strictEqual(fLoser.data.conflict.type, 'folder', 'Conflict type must be folder');
  assert.strictEqual(fLoser.data.conflict.path, 'components', 'Conflict path must be components');
  console.log('✅ Test 5 PASSED: Concurrent folder creation resolved with 409 Conflict.');

  // --- TEST 6: Correct Conflict Scope ---
  console.log('\n📌 Test 6: Conflict Scope (Different folder and different workspace)...');
  // Same filename in different folder: 'components/app.py' vs root 'app.py'
  const subFileRes = await postJson(`/rooms/${demoRoomId}/files`, {
    path: 'components/app.py',
    content: '# Subfolder app',
    idempotencyKey: `idem_sub_${nonce}`,
  });
  assert.strictEqual(subFileRes.status, 201, 'Same filename in different folder must be permitted');

  // Same filename in different workspace
  const otherRoomId = `room_demo_other_${nonce}`;
  const otherRoomRes = await postJson(`/rooms/${otherRoomId}/files`, {
    path: 'app.py',
    content: '# Other room app',
    idempotencyKey: `idem_other_${nonce}`,
  });
  assert.strictEqual(otherRoomRes.status, 201, 'Same filename in different workspace must be permitted');

  // Folder vs File collision: Cannot create a file named 'components' because folder 'components' exists
  const folderCollisionRes = await postJson(`/rooms/${demoRoomId}/files`, {
    path: 'components',
    content: '# Trying to overwrite folder with file',
    idempotencyKey: `idem_col_${nonce}`,
  });
  assert.strictEqual(folderCollisionRes.status, 409, 'Creating file with same name as existing folder must fail with 409');
  console.log('✅ Test 6 PASSED: Folder and workspace scopes enforced correctly; folder vs file collision detected.');

  // --- TEST 7: Security & No Content Leakage ---
  console.log('\n📌 Test 7: Security & No Content Leakage on 409 Conflict...');
  const probeConflict = await postJson(`/rooms/${demoRoomId}/files`, {
    path: 'app.py',
    content: '',
  });
  assert.strictEqual(probeConflict.status, 409);
  assert.strictEqual(probeConflict.data.conflict.existingItem?.content, undefined, 'Conflict payload must NEVER leak existing file content');

  // Directory traversal rejection
  const traversalRes = await postJson(`/rooms/${demoRoomId}/files`, {
    path: '../../etc/passwd',
    content: '',
  });
  assert.strictEqual(traversalRes.status, 400, 'Directory traversal path must be rejected with 400');
  console.log('✅ Test 7 PASSED: File contents are never leaked in conflict responses, traversal rejected.');

  console.log(`\n================================================================`);
  console.log(`🎉 ALL 7 SMART CONFLICT RESOLUTION TEST SUITES PASSED!`);
  console.log(`================================================================\n`);
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
