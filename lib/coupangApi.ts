import crypto from 'node:crypto';

const BASE_URL = 'https://api-gateway.coupang.com';

// 쿠팡 파트너스 Open API HMAC 서명 방식 (공식 문서 기준: CEA algorithm=HmacSHA256)
function sign(method: string, pathWithQuery: string, secretKey: string, accessKey: string) {
  const datetime = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
    .slice(0, 15) + 'Z'; // yyMMddTHHmmssZ 형태로 맞춤
  const message = datetime + method + pathWithQuery;
  const signature = crypto.createHmac('sha256', secretKey).update(message).digest('hex');
  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
  return { authorization, datetime };
}

export async function coupangSearchProducts(accessKey: string, secretKey: string, keyword: string, limit = 10) {
  const path = '/v2/providers/affiliate_open_api/apis/openapi/products/search';
  const query = `?keyword=${encodeURIComponent(keyword)}&limit=${limit}`;
  const { authorization } = sign('GET', path + query, secretKey, accessKey);

  const res = await fetch(BASE_URL + path + query, {
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!res.ok || json.rCode !== '0') {
    throw new Error(json.rMessage || `쿠팡 검색 실패 (${res.status})`);
  }
  return (json.data?.productData || []) as {
    productName: string;
    productPrice: number;
    productImage: string;
    productUrl: string;
    productId: number;
  }[];
}

export async function coupangDeeplink(accessKey: string, secretKey: string, urls: string[]) {
  const path = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';
  const { authorization } = sign('POST', path, secretKey, accessKey);
  const body = JSON.stringify({ coupangUrls: urls });

  const res = await fetch(BASE_URL + path, {
    method: 'POST',
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body,
  });
  const json = await res.json();
  if (!res.ok || json.rCode !== '0') {
    throw new Error(json.rMessage || `딥링크 생성 실패 (${res.status})`);
  }
  return (json.data || []) as { originalUrl: string; shortenUrl: string; landingUrl: string }[];
}
