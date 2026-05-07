import { searchFilesPattern } from './src_js/tools/searchTools.js';

async function test() {
  console.log('Testing pattern: test_dir/subdir/*.js');
  const res1 = await searchFilesPattern({pattern: 'test_dir/subdir/*.js'});
  console.log('Result 1:', res1);

  console.log('Testing pattern: test_dir/*.js');
  const res2 = await searchFilesPattern({pattern: 'test_dir/*.js'});
  console.log('Result 2:', res2);

  console.log('Testing pattern: a.js');
  const res3 = await searchFilesPattern({pattern: 'a.js'});
  console.log('Result 3:', res3);
}

test().catch(console.error);