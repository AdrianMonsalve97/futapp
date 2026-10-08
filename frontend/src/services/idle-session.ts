import type {SessionStatus} from '../types/api';

export interface IdleMessage { key:string; kind:'activity'|'logout'; at:number; reason?:'idle'|'manual' }
export interface IdleEnvironment {
  now:()=>number;
  visible:()=>boolean;
  timer:(callback:()=>void,delay:number)=>number;
  cancel:(id:number)=>void;
  activity:(callback:()=>void)=>()=>void;
  wake:(callback:()=>void)=>()=>void;
  peer:(callback:(message:IdleMessage)=>void)=>()=>void;
  latestPeer:()=>IdleMessage|null;
  publish:(message:IdleMessage)=>void;
}
const ACTIVITY_INTERVAL=60000;
const IDLE_CHANNEL='futapp:session-activity';

/** Only real input renews the deadline. Polling, focus and refresh do not. */
export function startIdleSession(status:SessionStatus,environment:IdleEnvironment,heartbeat:()=>Promise<unknown>,onClose:(reason:'idle'|'remote')=>void):()=>void {
  if(status.idleTimeoutMs===null||status.idleExpiresAt===null)return ()=>{};
  const timeout=status.idleTimeoutMs;
  let deadline=environment.now()+Math.max(0,status.idleExpiresAt-status.serverNow);
  let expiryTimer:number|undefined,pulseTimer:number|undefined,stopped=false,pending=false,sending=false,lastSent=environment.now();
  const unsubscribers:(()=>void)[]=[];
  const stop=()=>{stopped=true;if(expiryTimer!==undefined)environment.cancel(expiryTimer);if(pulseTimer!==undefined)environment.cancel(pulseTimer);unsubscribers.forEach(unsubscribe=>unsubscribe());};
  const close=(reason:'idle'|'remote')=>{
    if(stopped)return;stop();
    if(reason==='idle')environment.publish({key:status.sessionKey,kind:'logout',at:environment.now(),reason:'idle'});
    onClose(reason);
  };
  const adopt=(message:IdleMessage|null)=>{
    if(!message||message.key!==status.sessionKey||stopped)return;
    if(message.kind==='logout'){close('remote');return;}
    if(message.kind!=='activity'||!Number.isFinite(message.at)||message.at>environment.now())return;
    deadline=Math.max(deadline,message.at+timeout);
  };
  const check=()=>{adopt(environment.latestPeer());if(stopped)return true;if(environment.now()>=deadline){close('idle');return true;}return false;};
  const scheduleExpiry=()=>{if(expiryTimer!==undefined)environment.cancel(expiryTimer);expiryTimer=environment.timer(()=>{if(!check())scheduleExpiry();},Math.max(0,deadline-environment.now()));};
  const pulse=async()=>{
    pulseTimer=undefined;
    if(check()||!pending||sending||!environment.visible())return;
    sending=true;pending=false;lastSent=environment.now();
    try {await heartbeat();}catch {pending=true;}
    finally {sending=false;if(!stopped&&pending)schedulePulse();}
  };
  const schedulePulse=()=>{
    if(stopped||pulseTimer!==undefined||sending)return;
    pulseTimer=environment.timer(()=>void pulse(),Math.max(0,lastSent+ACTIVITY_INTERVAL-environment.now()));
  };
  unsubscribers.push(environment.activity(()=>{
    if(check()||!environment.visible())return;
    const now=environment.now();deadline=now+timeout;pending=true;scheduleExpiry();schedulePulse();
    environment.publish({key:status.sessionKey,kind:'activity',at:now});
  }));
  unsubscribers.push(environment.wake(()=>{if(!check()&&pending)schedulePulse();}));
  unsubscribers.push(environment.peer(message=>{
    adopt(message);if(!check())scheduleExpiry();
  }));
  if(!check())scheduleExpiry();
  return stop;
}

export function publishSessionLogout(key:string):void {
  publish({key,kind:'logout',reason:'manual',at:Date.now()});
}
function publish(message:IdleMessage):void {
  try {window.localStorage.setItem(IDLE_CHANNEL,JSON.stringify(message));}catch {/* Storage may be blocked; server expiration remains enforced. */}
}
export function browserIdleEnvironment():IdleEnvironment {
  return {
    now:()=>Date.now(),visible:()=>document.visibilityState==='visible',
    timer:(callback,delay)=>window.setTimeout(callback,delay),cancel:id=>window.clearTimeout(id),publish,
    latestPeer:()=>{try{return JSON.parse(window.localStorage.getItem(IDLE_CHANNEL)??'null') as IdleMessage|null;}catch{return null;}},
    activity:callback=>{
      const events=['pointerdown','pointermove','keydown','wheel','touchstart'];
      let lastInput=0;
      const listener=(event:Event)=>{if(event.isTrusted&&Date.now()-lastInput>=1000){lastInput=Date.now();callback();}};
      events.forEach(event=>window.addEventListener(event,listener,{passive:true}));
      return ()=>events.forEach(event=>window.removeEventListener(event,listener));
    },
    wake:callback=>{
      window.addEventListener('focus',callback);document.addEventListener('visibilitychange',callback);window.addEventListener('pageshow',callback);
      return ()=>{window.removeEventListener('focus',callback);document.removeEventListener('visibilitychange',callback);window.removeEventListener('pageshow',callback);};
    },
    peer:callback=>{
      const listener=(event:StorageEvent)=>{
        if(event.key!==IDLE_CHANNEL||!event.newValue)return;
        try {const message=JSON.parse(event.newValue) as IdleMessage;if(typeof message.key==='string'&&['activity','logout'].includes(message.kind)&&typeof message.at==='number')callback(message);}catch {/* Ignore unrelated malformed storage events. */}
      };
      window.addEventListener('storage',listener);return ()=>window.removeEventListener('storage',listener);
    },
  };
}
