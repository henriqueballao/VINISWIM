import test from 'node:test';import assert from 'node:assert/strict';
import {officialMeetUrl,officialRequestError} from './official-meet-url.ts';
const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
test('official meet URLs are normalized without changing official identity',()=>{
 assert.equal(officialMeetUrl(`https://swimsystem.app/meets/sw/${id}/?utm_source=synthetic#results`),`https://www.swimsystem.app/meets/sw/${id}`);
 for(const url of [`http://swimsystem.app/meets/sw/${id}`,`https://swimsystem.app.evil.example/meets/sw/${id}`,`https://user:password@swimsystem.app/meets/sw/${id}`,`https://swimsystem.app:8443/meets/sw/${id}`,`https://swimsystem.app/meets/sw/${id}/results`,'not a URL'])assert.equal(officialMeetUrl(url),null);
});
test('identity and tenant denial explain the reason rather than claim success',()=>{
 assert.match(officialRequestError('SOURCE_IDENTITY_CONFLICT'),/conflitantes/);
 assert.match(officialRequestError('ATHLETE_ACCESS_DENIED'),/não tem acesso/);
});
