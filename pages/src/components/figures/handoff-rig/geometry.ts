import { cylinder, iso, lineOnTop, planOutline, slabOf, type Plan, type SolidPaths, type Tone } from "../../anatomy-kit/iso-kit";
import { BASE, BASE_Z, HEIGHT, P, WIDTH } from "./view";

export type Part = { id:string; paths:SolidPaths; tone:Tone; lit?:boolean };
const solid=(id:string,plan:Plan,z:number,h:number,tone:Tone="mid"):Part=>({id,paths:slabOf(plan,z,h,P,6,.6),tone});
const round=(id:string,x:number,y:number,r:number,z:number,h:number,tone:Tone="mid"):Part=>({id,paths:cylinder(x,y,r,z,h,P,20,.35),tone});
const point=(x:number,y:number,z:number)=>iso([x,y,z],P);

export const BASE_ART={
  slab:solid("bench",BASE,BASE_Z,7,"mid"),
  feet:[[-103,-57],[103,-57],[-103,57],[103,57]].map(([x,y],i)=>round(`bench-foot-${i}`,x!,y!,5,BASE_Z-4,4,"lo")),
};

export const CONVEYOR={
  bed:solid("belt-bed",{x:-96,y:-27,w:190,d:54,r:4},2,7,"lo"),
  belt:solid("belt",{x:-91,y:-22,w:180,d:44,r:3},9,1,"hi"),
  rails:[solid("belt-rail-back",{x:-94,y:-29,w:186,d:3,r:1},9,5),solid("belt-rail-front",{x:-94,y:26,w:186,d:3,r:1},9,5)],
  slats:Array.from({length:13},(_,i)=>lineOnTop([-86+i*14,-22],[-86+i*14,22],10,P)),
  ends:[solid("belt-pulley-left",{x:-94,y:-23,w:6,d:46,r:2},8,4,"mid"),solid("belt-pulley-right",{x:83,y:-23,w:6,d:46,r:2},8,4,"mid")],
  supports:[[-72,-27],[65,-27],[-72,27],[65,27]].map(([x,y],i)=>solid(`belt-support-${i}`,{x:x!-3,y:y!-3,w:6,d:6,r:1},-1,3,"lo")),
};

export const ORDER={
  board:solid("traveler-board",{x:-37,y:-23,w:74,d:46,r:3},10,3,"mid"),
  sheet:{...solid("traveler-sheet",{x:-34,y:-20,w:68,d:40,r:2},13,1,"hi"),lit:true},
  clip:[solid("traveler-clip",{x:-9,y:-21,w:18,d:4,r:1},14,2,"mid"),round("traveler-clip-pin",0,-19,1.4,16,1,"hi")],
  header:solid("traveler-heading",{x:-27,y:-13,w:25,d:2,r:.5},14,.3,"mid"),
  lines:[-6,1,8].map((y,i)=>solid(`traveler-line-${i}`,{x:-27,y,w:i===1?27:36,d:1.2,r:.3},14,.25,"lo")),
  checks:[-6,1,8].map((y,i)=>solid(`traveler-check-${i}`,{x:27,y:y-.8,w:1.6,d:1.6,r:.2},14,.35,i===0?"mid":"lo")),
  envelope:planOutline({x:16,y:-14,w:9,d:6,r:.5},14,P),
  flap:`M${point(16,-14,14).join(" ")}L${point(20.5,-11,14).join(" ")}L${point(25,-14,14).join(" ")}`,
  start:[-55,0,0] as [number,number,number],
  working:[-3,0,0] as [number,number,number],
};

export const OPERATOR={
  console:[solid("operator-base",{x:-13,y:-57,w:44,d:24,r:3},8,3),solid("operator-console",{x:-9,y:-55,w:36,d:20,r:3},11,21,"mid")],
  screen:solid("operator-screen",{x:-5,y:-53,w:28,d:14,r:2},32,1,"hi"),
  screenLines:[-48,-45,-42].map((y,i)=>lineOnTop([-1,y], [i===1?12:17,y],33,P)),
  handset:[solid("intercom",{x:-25,y:-36,w:27,d:5,r:2},10,2,"hi"),round("intercom-earpiece",-23,-33.5,3,10,2,"mid"),round("intercom-mouthpiece",0,-33.5,3,10,2,"mid")],
  acpRoute:[[-12,-36,12],[-15,-31,12],[-12,-26,12],[-5,-23,13],[6,-22,14],[15,-16,15],[18,-8,16],[13,0,17],[4,4,17],[-3,2,17]] as [number,number,number][],
  messagePoints:[[-8,-25,14],[-1,-22,14],[6,-20,15]].map(([x,y,z])=>point(x!,y!,z!)),
};

export const RECORDS={
  cabinet:[solid("records-base",{x:-91,y:-55,w:34,d:27,r:2},7,3),solid("records-cabinet",{x:-88,y:-52,w:28,d:21,r:2},10,24,"mid")],
  door:solid("records-door",{x:-86,y:-49,w:23,d:16,r:1},14,17,"hi"),
  shelves:[-43,-37].map((y,i)=>lineOnTop([-82,y],[-66,y],30,P)),
  key:[round("mcp-key-head",-61,-32,3.4,9,2,"hi"),solid("mcp-key-shaft",{x:-59,y:-33,w:13,d:2,r:.5},9,1.5,"mid")],
  route:[[-59,-32,10],[-53,-37,10],[-50,-48,12],[-45,-59,14],[-25,-63,15],[0,-63,16],[20,-58,17],[28,-49,18],[23,-42,19],[12,-39,20]] as [number,number,number][],
};

export const REVIEW={
  tray:[solid("review-tray",{x:57,y:-21,w:42,d:42,r:3},8,3,"mid"),solid("review-back-stop",{x:57,y:20,w:42,d:2,r:.5},11,8,"lo"),solid("review-side-stop",{x:97,y:-21,w:2,d:43,r:.5},11,6,"lo")],
  paper:{...solid("evidence-sheet",{x:63,y:-14,w:30,d:29,r:2},12,1,"hi"),lit:true},
  marks:[-8,-2,4].map((y,i)=>solid(`evidence-line-${i}`,{x:68,y,w:i===1?12:18,d:1,r:.3},13,.2,"lo")),
  stamp:[solid("review-stamp-arm",{x:72,y:23,w:4,d:20,r:1},20,14,"mid"),solid("review-stamp-head",{x:67,y:10,w:14,d:13,r:2},19,3,"hi")],
  acceptLever:solid("accept-lever",{x:84,y:14,w:15,d:3,r:1},23,2,"hi"),
  goal:[solid("goal-base",{x:99,y:-25,w:10,d:12,r:2},8,3,"lo"),round("goal-beacon",104,-19,4,11,8,"hi")],
};

