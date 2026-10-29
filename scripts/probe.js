const {requestPage,parseOfficialResponse} = require('../lib/source');
requestPage(1).then(body => {
  // requestPage resolves only for HTTP 200 with a JSON response.
  console.error('Official endpoint HTTP 200');
  const row = parseOfficialResponse(body)[0];
  process.stdout.write(JSON.stringify(row) + '\n');
}).catch(error => {console.error(error.message); process.exitCode = 1;});

