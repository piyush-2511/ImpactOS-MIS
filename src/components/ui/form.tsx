'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { cn } from '@/lib/utils';
import { Label } from './label';

/** react-hook-form bindings. One zod schema per entity drives the form, the server action and the importer. */
const Form = FormProvider;

type FormFieldContextValue = { name: string };
const FormFieldContext = React.createContext<FormFieldContextValue | null>(null);
const FormItemContext = React.createContext<{ id: string } | null>(null);

function FormField<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>(
  props: ControllerProps<TFieldValues, TName>,
) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

function useFormField() {
  const field = React.useContext(FormFieldContext);
  const item = React.useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: field?.name });
  if (!field || !item) throw new Error('useFormField must be used inside <FormField> and <FormItem>');
  const state = getFieldState(field.name, formState);
  return { id: item.id, name: field.name, formItemId: `${item.id}-item`, descriptionId: `${item.id}-description`, messageId: `${item.id}-message`, ...state };
}

function FormItem({ className, ...props }: React.ComponentProps<'div'>) {
  const id = React.useId();
  return (
    <FormItemContext.Provider value={{ id }}>
      <div data-slot="form-item" className={cn('flex flex-col gap-1.5', className)} {...props} />
    </FormItemContext.Provider>
  );
}
function FormLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  const { error, formItemId } = useFormField();
  return <Label data-error={!!error} className={cn('data-[error=true]:text-destructive', className)} htmlFor={formItemId} {...props} />;
}
function FormControl(props: React.ComponentProps<typeof Slot>) {
  const { error, formItemId, descriptionId, messageId } = useFormField();
  return <Slot id={formItemId} aria-describedby={error ? `${descriptionId} ${messageId}` : descriptionId} aria-invalid={!!error} {...props} />;
}
function FormDescription({ className, ...props }: React.ComponentProps<'p'>) {
  const { descriptionId } = useFormField();
  return <p id={descriptionId} className={cn('text-sm text-muted-foreground', className)} {...props} />;
}
function FormMessage({ className, children, ...props }: React.ComponentProps<'p'>) {
  const { error, messageId } = useFormField();
  const body = error ? String(error.message ?? '') : children;
  if (!body) return null;
  return (
    <p id={messageId} role="alert" className={cn('text-sm font-medium text-destructive', className)} {...props}>
      {body}
    </p>
  );
}

export { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, useFormField };
