import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatePassword} from '../backend/src/domain/password-policy';
import {passwordError} from '../frontend/src/utils/password';

test('eight characters require each category; whitespace and invisible separators are not special characters',()=>{
  for(const value of ['Nueva12!','Árbol12!','Nueva12_','Abc1'+'.'.repeat(68),'Aa1!'+ 'ñ'.repeat(34)]){
    assert.doesNotThrow(()=>validatePassword(value));assert.equal(passwordError(value),null);
  }
  for(const value of ['', 'Abc12!x', 'nueva12!', 'NUEVA12!', 'Nuevas!!', 'Nueva123', 'Nueva12 ', 'Nueva12\u200b', '12345678', 'A'.repeat(20)]){
    assert.throws(()=>validatePassword(value),/8 caracteres/);assert(passwordError(value));
  }
  for(const value of ['Abc1'+'.'.repeat(69),'Aa1!'+ 'ñ'.repeat(35)]){
    assert.throws(()=>validatePassword(value),/72 bytes/);assert.match(passwordError(value)!,/72 bytes/);
  }
});
