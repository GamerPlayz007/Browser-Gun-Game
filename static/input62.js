/** Stage 6.2: preserve a quick Space tap between two rendered frames.
 * Latch expires only after a fixed movement tick consumes it. The held state
 * remains separate so Stage 6.3 can add hold-to-hop without input loss.
 */
export function createJumpLatch62(){
 let pending=false;
 return {
  press(){pending=true;},
  read(held=false){return pending||Boolean(held);},
  consume(){pending=false;},
  clear(){pending=false;},
  get pending(){return pending;}
 };
}
