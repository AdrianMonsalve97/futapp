import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {layoutPitch,PITCH_HEIGHT} from '../frontend/src/utils/pitch-layout';
import {formationsFor} from '../frontend/src/data/formations';
import type {AiPlayerInsight as FrontInsight,Position} from '../frontend/src/types/api';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'futapp-preparation-'));
process.env.DB_PATH=path.join(directory,'portal.db');process.env.NODE_ENV='test';
process.env.JWT_SECRET='isolated-preparation-test-secret-1234567890';
const {migrate}=await import('../backend/src/adapters/out/persistence/migrate');
const {getDb,closeDb}=await import('../backend/src/adapters/out/persistence/database');
const {createContainer}=await import('../backend/src/container');
const {SqliteUserRepository}=await import('../backend/src/adapters/out/persistence/repositories/user.repository');
migrate();const db=getDb(),c=createContainer(),users=new SqliteUserRepository(db);
db.prepare('UPDATE team_settings SET format=8').run();
const squad=[];
for(const [i,position] of (['POR','DEF','DEF','DEF','MED','MED','MED','DEL','MED','DEL','MED','DEL','MED'] as Position[]).entries()) {
  squad.push(await c.playerService.create({email:`player${i}@preparation.test`,password:'Preparation test passphrase 123!',fullName:`Integrante ${i}`,position,shirtNumber:i+1}));
}
await users.update(squad[1].user.id,{avatarUrl:'/api/media/defender-photo'});
await users.update(squad[12].user.id,{active:false});
after(()=>{closeDb();assert.equal(path.dirname(directory),os.tmpdir());fs.rmSync(directory,{recursive:true,force:true});});

test('F8 without a fixture fills a training map from the existing squad, with photos and a goalkeeper focus',async()=>{
  const insight=await c.aiService.playerInsight(squad[0].player.id),plan=insight.preparation;
  assert.equal(plan.matchId,null);assert.equal(plan.assignment,'sin_partido');assert.equal(plan.role,'POR');assert.equal(plan.minutes,50);
  assert.equal(plan.trainingScope,'plantel');assert.equal(plan.lineup.length,0);assert.equal(plan.publishedAt,null);
  assert.equal(plan.trainingLineup.length,8);assert.equal(plan.trainingLineup.filter(slot=>slot.playerId!==null).length,8);
  assert.equal(new Set(plan.trainingLineup.map(slot=>slot.playerId)).size,8);
  assert.equal(plan.trainingLineup.find(slot=>slot.role==='POR')?.playerId,squad[0].player.id);
  assert.equal(plan.trainingLineup.find(slot=>slot.playerId===squad[1].player.id)?.avatarUrl,'/api/media/defender-photo');
  assert.equal(plan.teammates.length,12);assert(!plan.teammates.some(player=>player.playerId===squad[12].player.id));
  assert.deepEqual(Object.keys(plan.teammates[0]).sort(),['avatarUrl','playerId','playerName','position','shirtNumber'].sort());
  assert(plan.individual.some(item=>item.title==='Uno contra uno'));assert(plan.plays.some(play=>play.id==='portero'));
  assert.equal((db.prepare('SELECT COUNT(*) n FROM matches').get() as {n:number}).n,0);
});

test('individual coaching is available for every registered role before match history exists',async()=>{
  for(const index of [0,1,4,7]) {
    const insight=await c.aiService.playerInsight(squad[index].player.id);
    assert.equal(insight.preparation.role,squad[index].player.position);
    assert(insight.preparation.individual.length>=3);assert(insight.preparation.training.length>=3);
    assert.equal(insight.forecast.history.length,0);
    assert(insight.preparation.teammates.some(player=>player.playerId===squad[index].player.id));
  }
});

test('compact-format maps separate portraits and captions, including historical stored geometry',()=>{
  for(const format of [5,7,8] as const)for(const formation of formationsFor(format)) {
    const original=structuredClone(formation.slots),slots=layoutPitch(original,format);
    assert.deepEqual(original,formation.slots);assert.equal(slots.length,format);
    for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++) {
      const separation=Math.hypot(slots[i].x-slots[j].x,(slots[i].y-slots[j].y)*PITCH_HEIGHT[format]/100);
      assert(separation>=22,`${format}/${formation.key}: cramped slots ${i}, ${j}`);
    }
    const advanced=layoutPitch(original,format,'ataque'),defending=layoutPitch(original,format,'repliegue');
    assert.equal(advanced.find(slot=>slot.role==='POR')?.y,slots.find(slot=>slot.role==='POR')?.y);
    assert(advanced.filter(slot=>slot.role!=='POR').every((slot,i)=>slot.y<defending.filter(s=>s.role!=='POR')[i].y));
  }
});

test('goalkeeper preparation renders prominently, with teammates, scenarios, practices and the keeper play selected',async()=>{
  (globalThis as any).React=React;
  const {AuthProvider}=await import('../frontend/src/context/AuthContext');
  const {IndividualPreparation}=await import('../frontend/src/organisms/IndividualPreparation');
  const insight=await c.aiService.playerInsight(squad[0].player.id);
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,{children:React.createElement(AuthProvider,{children:React.createElement(IndividualPreparation,{insight:insight as FrontInsight})})}));
  assert(html.includes('Enfoque de portero'));assert(html.includes('Laboratorio del portero'));assert(html.includes('Mapa de entrenamiento'));
  assert(html.includes('Con balón'));assert(html.includes('Sin balón'));assert(html.includes('Mi rutina de preparación'));
  assert(html.includes('type="checkbox"'));assert(html.includes('Más compañeros para rotar'));assert(html.includes('Portero conectado con la defensa'));
  assert(html.includes('Falta la foto de este jugador'));assert(!html.includes('Estás en el inicial publicado'));
  assert.equal((html.match(/class="pitch-player /g)??[]).length,8);
});
