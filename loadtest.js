import { check, sleep } from 'k6';
import http from 'k6/http';

export let options = {
  stages: [
    { duration: '30s', target: 50 }, // ramp up
    { duration: '30s', target: 150 },
    { duration: '1m', target: 300 }, // hold peak load
    { duration: '30s', target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests <500ms
    http_req_failed: ['rate<0.01'], // <1% errors
  },
};

export default function () {
  const baseUrl = 'http://localhost:5000';
  const loginRes = http.post(
    `${baseUrl}/auth/login`,
    JSON.stringify({
      username: 'test_student_1',
      password: 'test1',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  const token = JSON.parse(loginRes.body).token;

  http.get(`${baseUrl}/assignment/view?id=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const res = http.post(
    `${baseUrl}/assignment/submit`,
    JSON.stringify({
      submission: {
        assignment_id: 1,
        stage_id: 1,
        content: `{"content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus id mi tortor. Donec efficitur urna at suscipit semper. Morbi tristique nisl quis enim molestie fermentum. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Morbi facilisis sollicitudin tellus et facilisis. Donec vitae neque nunc. Nullam non mauris tincidunt, malesuada ante quis, pellentesque justo.Nunc et vestibulum dolor. Mauris sit amet lectus ac nisi varius tristique in sit amet purus. Ut eget libero at libero vehicula gravida non suscipit diam. Morbi a mauris lorem. Fusce consectetur auctor bibendum. Ut non ornare nunc. Donec congue aliquam malesuada. Suspendisse malesuada lorem at lectus rhoncus, eleifend vehicula est rutrum. Vestibulum vel condimentum massa, nec aliquam tellus. Proin commodo mauris justo, vel bibendum augue mollis sit amet. Nullam ut posuere felis. Ut ut scelerisque est, quis tristique nisi. Praesent quis cursus enim. Sed eu quam tellus. Mauris dictum mauris sit amet sem finibus viverra. Phasellus enim nunc, pharetra vel elementum non, commodo eu diam. Duis a nisl et nisi varius aliquam sit amet ac justo. Curabitur odio enim, dictum in pulvinar id, finibus in nulla. Phasellus dictum justo vitae pellentesque tincidunt. Aenean at imperdiet lorem. Phasellus eros ex, ullamcorper fringilla lorem sed, mattis convallis lorem. Fusce vestibulum dictum metus et sollicitudin. Phasellus gravida vestibulum mi, sit amet commodo ex sagittis sed. Aliquam ullamcorper purus quis augue porta efficitur. Donec ut faucibus ligula. Suspendisse molestie facilisis porta. Nullam porta maximus turpis, at consequat mauris auctor eget. Donec accumsan metus venenatis mi faucibus, eu placerat felis interdum.Sed velit felis, varius sit amet mi tempor, tempor mattis augue. Interdum et malesuada fames ac ante ipsum primis in faucibus. Morbi ac luctus nulla. Integer tincidunt vulputate enim, convallis posuere dui molestie vel. Fusce sollicitudin maximus tortor. Phasellus sollicitudin lorem eleifend dui interdum tincidunt. Curabitur bibendum, velit non auctor pharetra, lacus eros placerat dui, et finibus mi elit ut odio. Maecenas convallis dolor pulvinar lectus tincidunt congue id sit amet nibh. Nam ultricies lorem et enim lacinia sagittis. Duis imperdiet non felis ut lacinia. Phasellus venenatis ligula faucibus blandit accumsan. Aenean lobortis risus nec arcu maximus, vel pulvinar massa vestibulum. Aliquam malesuada arcu feugiat, ornare nisl vitae, semper magna.Etiam tortor metus, convallis nec pretium at, faucibus quis nulla. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Pellentesque sit amet rutrum diam. Quisque dui nulla, commodo ut mauris ut, porta commodo magna. Sed pretium ligula non arcu faucibus varius. Sed at est in ante condimentum pharetra. Nulla tempor augue arcu, a consectetur massa sollicitudin nec. Praesent vitae ipsum quis ante tincidunt interdum. Proin ac eleifend nulla. Ut mollis, lectus sit amet auctor convallis, massa massa tristique felis, nec suscipit ipsum magna id elit. Vestibulum eu tincidunt dolor, vitae ullamcorper tellus. Ut odio quam, condimentum non libero nec, rutrum accumsan velit. Nam hendrerit nunc ac orci dapibus, et semper odio eleifend. Quisque tellus augue, tincidunt sit amet elementum ullamcorper, malesuada eu ante. Duis commodo mi nunc, ut efficitur est fermentum non."}`,
        is_final: false,
        is_manual: false,
      },
    }),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (
    !check(res, {
      'status is 200': r => r.status === 200,
    })
  ) {
    // eslint-disable-next-line no-undef
    console.error(
      `❌ ${res.request.method} ${res.request.url} failed with status ${res.status}: ${res.body}`,
    );
  }

  sleep(1);
}
// k6 run --http-debug="failed" loadtest.js
