const CERT_BASE = '/etc/letsencrypt-tmp';

export default {

  chow: {
    dbUrl:  'mongodb://localhost:27017/chow',
  },

  ws: {
    port: 2345,
    base: '',
  },

  https: {
    certPath: `${CERT_BASE}/live/zdu.binghamton.edu/cert.pem`,
    caPath: `${CERT_BASE}/live/zdu.binghamton.edu/chain.pem`,
    keyPath: `${CERT_BASE}/keys/0000_key-certbot.pem`,
  },
  

};
