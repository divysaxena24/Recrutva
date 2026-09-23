const http = require('http');

const routes = [
  '/',
  '/jobs',
  '/jobs/1',
  '/onboarding',
  '/dashboard',
  '/candidate-dashboard',
  '/dashboard/jobs',
  '/dashboard/candidates',
  '/dashboard/schedules',
  '/dashboard/jobs/create'
];

async function testRoute(path) {
  return new Promise((resolve) => {
    http.get('http://localhost:3000' + path, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const is404 = data.includes('404') && data.includes('Page not found');
        resolve({
          path,
          statusCode: res.statusCode,
          location: res.headers.location || null,
          is404Page: is404
        });
      });
    }).on('error', (err) => {
      resolve({ path, error: err.message });
    });
  });
}

async function run() {
  for (const r of routes) {
    const res = await testRoute(r);
    console.log(JSON.stringify(res));
  }
}

run();
