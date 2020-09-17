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
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from '../constants'
import { sendEmail } from '../utils/sendEmail'
import { v4 } from 'uuid'

@InputType()
class UsernamePasswordInput {
  @Field()
  email: string
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
  async me(@Ctx() { req }: MyContext) {
    if (!req.session.userId) {
      return null
    }

    return await User.findOne(req.session.userId)
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg('input') { username, email, password }: UsernamePasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    if (!email.includes('@')) {
      return {
        errors: [
          {
            field: 'email',
            message: 'must be a valid email'
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
    const user = await User.create({
      username: username,
      email: email,
      password: hashedPassword
    }).save()

    req.session.userId = user.id

    return { user }
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg('usernameOrEmail') usernameOrEmail: string,
    @Arg('password') password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const isEmail = usernameOrEmail.includes('@')
    const user = await User.findOne({
      where: isEmail
        ? { email: usernameOrEmail }
        : { username: usernameOrEmail }
    })

    if (!user) {
      return {
        errors: [
          {
            field: 'usernameOrEmail',
            message: 'username or email does not exist.'
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

    req.session.userId = user.id

    return { user }
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise(resolve =>
      req.session.destroy(err => {
        res.clearCookie(COOKIE_NAME)

        if (err) {
          resolve(false)
          return
        }

        resolve(true)
      })
    )
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg('email') email: string,
    @Ctx() { redis }: MyContext
  ) {
    const user = await User.findOne({ where: { email } })

    if (!user) {
      return true
    }

    const token = v4()
    await redis.set(
      `${FORGET_PASSWORD_PREFIX}${token}`,
      user.id,
      'ex',
      1000 * 60 * 60 * 60 * 24 * 3 // 3 days
    )
    sendEmail(
      email,
      `<a href="http://localhost:3000/change-password/${token}">reset password</a>`
    )

    return true
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg('token') token: string,
    @Arg('newPassword') newPassword: string,
    @Ctx() { redis, req }: MyContext
  ): Promise<UserResponse> {
    // add validation later

    const key = `${FORGET_PASSWORD_PREFIX}${token}`
    const userId = await redis.get(key)

    if (!userId) {
      return {
        errors: [
          {
            field: 'token',
            message: 'token expired'
          }
        ]
      }
    }

    const userIdNum = parseInt(userId)
    const user = await User.findOne(userIdNum)

    if (!user) {
      return {
        errors: [
          {
            field: 'token',
            message: 'token expired'
          }
        ]
      }
    }

    await User.update(
      { id: userIdNum },
      { password: await argon2.hash(newPassword) }
    )

    await redis.del(key)

    req.session.userId = user.id

    return { user }
  }
}
