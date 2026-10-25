"use client";

// Adapted from shadcn/ui base-nova Select (MIT); https://ui.shadcn.com/docs/components/base/select (MIT).
import {Select as SelectPrimitive} from '@base-ui/react/select';
import type {ComponentProps} from 'react';

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

function Chevron({up=false}:{up?:boolean}) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={up?'m6 15 6-6 6 6':'m6 9 6 6 6-6'}/></svg>;
}

export function SelectTrigger({children,...props}:SelectPrimitive.Trigger.Props) {
  return <SelectPrimitive.Trigger {...props} data-slot="select-trigger" className="m3-select-trigger">
    {children}<SelectPrimitive.Icon className="m3-select-icon"><Chevron/></SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>;
}

export function SelectContent({children,container,onDismiss,...props}:SelectPrimitive.Popup.Props & {container:ComponentProps<typeof SelectPrimitive.Portal>['container'];onDismiss:()=>void}) {
  return <SelectPrimitive.Portal container={container} className="m3-select-portal">
    <SelectPrimitive.Backdrop className="m3-select-backdrop" onClick={event=>{event.stopPropagation();onDismiss();}}/>
    <SelectPrimitive.Positioner align="start" sideOffset={6} alignItemWithTrigger={false} positionMethod="fixed" collisionBoundary={[]} collisionPadding={12} className="m3-select-positioner">
      <SelectPrimitive.Popup {...props} data-slot="select-content" className="m3-select-content">
        <SelectPrimitive.ScrollUpArrow className="m3-select-scroll" style={{position:'relative'}}><Chevron up/></SelectPrimitive.ScrollUpArrow>
        <SelectPrimitive.List className="m3-select-list">{children}</SelectPrimitive.List>
        <SelectPrimitive.ScrollDownArrow className="m3-select-scroll" style={{position:'relative'}}><Chevron/></SelectPrimitive.ScrollDownArrow>
      </SelectPrimitive.Popup>
    </SelectPrimitive.Positioner>
  </SelectPrimitive.Portal>;
}

export function SelectItem({children,...props}:SelectPrimitive.Item.Props) {
  return <SelectPrimitive.Item {...props} data-slot="select-item" data-value={props.value} className="m3-select-item">
    <SelectPrimitive.ItemText className="m3-select-item-text">{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="m3-select-check"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>;
}
