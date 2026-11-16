/** Stage 6.3: input mapping is separate from DOM and physics. */
export function createMovementControls63(){
 let crouched=false;
 return {
  toggleCrouch(){crouched=!crouched;return crouched;},
  reset(){crouched=false;},
  get crouched(){return crouched;},
  input(keys={},enabled=true){
   return {crouch:!!enabled&&crouched,
    leanLeft:!!enabled&&!!keys.KeyQ,leanRight:!!enabled&&!!keys.KeyE,
    interact:!!enabled&&!!keys.KeyF,slide:!!enabled&&!!keys.KeyC};
  }
 };
}
