import React, { InputHTMLAttributes } from 'react'
import {
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input
} from '@chakra-ui/core'
import { useField } from 'formik'

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  name: string
  label: string
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  size: _,
  ...props
}) => {
  const [field, { error }] = useField(props)

  return (
    <FormControl isInvalid={!!error}>
      <FormLabel htmlFor={field.name}>{label}</FormLabel>
      <Input
        {...field}
        {...props}
        id={field.name}
        placeholder={props.placeholder}
      />
      {error && <FormErrorMessage>{error}</FormErrorMessage>}
    </FormControl>
  )
}
