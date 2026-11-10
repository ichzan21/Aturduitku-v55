import React, { useId } from 'react';

export default function Field({label,labelStyle,children}) {
  const generated=useId();
  const control=React.Children.only(children);
  const id=control.props.id||`field-${generated}`;
  return <><label htmlFor={id} style={labelStyle}>{label}</label>{React.cloneElement(control,{id})}</>;
}
