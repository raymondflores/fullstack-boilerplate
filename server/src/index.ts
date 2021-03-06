import 'reflect-metadata'
import { COOKIE_NAME, __prod__ } from './constants'

import express from 'express'
import { ApolloServer } from 'apollo-server-express'
import { buildSchema } from 'type-graphql'
import Redis from 'ioredis'
import session from 'express-session'
import connectRedis from 'connect-redis'
import cors from 'cors'

import { HelloResolver } from './resolvers/hello'
import { PostResolver } from './resolvers/post'
import { UserResolver } from './resolvers/user'

import { createConnection } from 'typeorm'
import { User } from './entities/User'
import { Post } from './entities/Post'

const main = async () => {
  const conn = await createConnection({
    type: 'postgres',
    database: 'reddit2',
    username: 'raymond',
    password: '',
    logging: true,
    synchronize: true,
    entities: [User, Post]
  })

  const app = express()
  const RedisStore = connectRedis(session)
  const redis = new Redis()

  app.use(
    cors({
      origin: 'http://localhost:3000',
      credentials: true
    })
  )

  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({
        client: redis,
        disableTouch: true
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
        httpOnly: true,
        sameSite: 'lax', // csrf
        secure: __prod__ // only works in https
      },
      saveUninitialized: false,
      secret: 'keyboard cat',
      resave: false
    })
  )

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false
    }),
    context: ({ req, res }) => ({ req, res, redis })
  })
  apolloServer.applyMiddleware({
    app,
    cors: false
  })

  app.listen(4000, () => {
    console.log('Listening on port 4000...')
  })
}

main().catch(console.error)
