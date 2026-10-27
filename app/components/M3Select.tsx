"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {useModalVisibility} from '@/app/components/Modal';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from './ui/select';


type Option={value:string;label:string;disabled?:boolean};
export function M3Select({id,value,onValueChange,options,leadingIcon,variant="field"}:{id:string;value:string;onValueChange:(value:string)=>void;options:Option[];leadingIcon?:ReactNode;variant?:"field"|"tonal"}) {
  const trigger=useRef<HTMLButtonElement>(null);
  const [portal,setPortal]=useState<HTMLElement|null>(null);
  const [open,setOpen]=useState(false);
  const visible=useModalVisibility();
  useEffect(()=>{if(!visible)setOpen(false);},[visible]);
  // Keep the popup inside the existing modal's focus boundary and M3 token scope.
  const setContainer=(open:boolean)=>{if(open)setPortal(trigger.current?.closest('[role="dialog"]')?.querySelector<HTMLElement>(':scope > [tabindex="-1"]')??document.body);};
  // The existing Modal owns its scroll lock; standalone Select uses Base UI's lock.
  return <Select value={value} items={options} open={open&&visible} modal={portal?.tagName==='BODY'} onOpenChange={(next,details)=>{
    // Consume the backdrop click before dismissing, so it cannot also close the parent modal.
    if(details.reason==='outside-press'){details.cancel();return;}
    setContainer(next);setOpen(next);
  }} onValueChange={next=>{if(next!==null)onValueChange(next);}}>
    <SelectTrigger id={id} ref={trigger} aria-labelledby={id+'-label'} data-value={value} data-variant={variant}>
      {leadingIcon && <span className="m3-select-leading" aria-hidden="true">{leadingIcon}</span>}
      <SelectValue data-slot="select-value"/>
    </SelectTrigger>
    <SelectContent container={portal} finalFocus={trigger} onDismiss={()=>setOpen(false)}>
      {options.map(option=><SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>)}
    </SelectContent>
  </Select>;
}
