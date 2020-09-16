import { MikroORM } from '@mikro-orm/core'
import { __prod__ } from './constants'
import path from 'path'

import { Post } from './entities/Post'
import { User } from './entities/User'

export default {
  migrations: {
    path: path.join(__dirname, './migrations'), // path to the folder with migrations
    pattern: /^[\w-]+\d+\.ts$/ // regex pattern for the migration files
  },
  entities: [Post, User],
  dbName: 'reddit',
  user: 'raymond',
  type: 'postgresql',
  debug: !__prod__
} as Parameters<typeof MikroORM.init>[0]
