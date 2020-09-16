import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver
} from 'type-graphql'

import { MyContext } from 'src/types'
import { User } from '../entities/User'
import argon2 from 'argon2'
import { EntityManager } from '@mikro-orm/postgresql'

@InputType()
class UsernamePasswordInput {
  @Field()
  username: string
  @Field()
  password: string
}

@ObjectType()
class FieldError {
  @Field()
  field: string
  @Field()
  message: string
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[]
  @Field(() => User, { nullable: true })
  user?: User
}

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async me(@Ctx() { em, req }: MyContext) {
    if (!req.session.userId) {
      return null
    }

    const user = await em.findOne(User, { id: req.session.userId })
    return user
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg('input') { username, password }: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    if (username.length <= 2) {
      return {
        errors: [
          {
            field: 'username',
            message: 'length must be greater than 2'
          }
        ]
      }
    }

    if (username.length <= 2) {
      return {
        errors: [
          {
            field: 'password',
            message: 'length must be greater than 2'
          }
        ]
      }
    }

    const hashedPassword = await argon2.hash(password)

    let user = em.create(User, {
      username,
      password: hashedPassword
    })

    try {
      const result = await (em as EntityManager)
        .createQueryBuilder(User)
        .getKnexQuery()
        .insert({
          username,
          password: hashedPassword,
          create_at: new Date(),
          updated_at: new Date()
        })
        .returning('*')

      user = result[0]
    } catch (err) {
      // duplicate username error
      if (err.code === '23505') {
        return {
          errors: [
            {
              field: 'username',
              message: 'username already taken.'
            }
          ]
        }
      }
    }

    req.session.userId = user.id

    return { user }
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg('input') { username, password }: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(User, { username })
    if (!user) {
      return {
        errors: [
          {
            field: 'username',
            message: 'username does not exist.'
          }
        ]
      }
    }

    const valid = await argon2.verify(user.password, password)
    if (!valid) {
      return {
        errors: [
          {
            field: 'password',
            message: 'incorrect password.'
          }
        ]
      }
    }

    console.log('setting userid', user.id)
    req.session.userId = user.id

    return { user }
  }
}
