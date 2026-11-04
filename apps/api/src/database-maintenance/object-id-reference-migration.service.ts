import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

const OBJECT_ID_PATTERN = '^[0-9a-fA-F]{24}$';

/**
 * Converts reference fields that were stored as 24-character hex strings into real ObjectIds.
 *
 * Schemas used to declare references with `type: Types.ObjectId`, which @nestjs/mongoose turns
 * into a Mixed path, so Mongoose never cast incoming strings. Those documents hold string ids,
 * and ObjectId-based queries (dashboard totals, scoped lists) silently match nothing. Now that
 * the schemas use `SchemaTypes.ObjectId`, new writes are cast; this brings existing data in
 * line. It runs on every start (and on `npm run reseed`), and is a no-op once nothing is left
 * to convert.
 */
@Injectable()
export class ObjectIdReferenceMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ObjectIdReferenceMigrationService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onApplicationBootstrap() {
    try {
      await this.convertStringReferences();
    } catch (error) {
      // Never block startup on maintenance; the next start retries.
      this.logger.error(
        'ObjectId reference migration failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async convertStringReferences() {
    let converted = 0;

    for (const model of Object.values(this.connection.models)) {
      const paths: string[] = [];

      model.schema.eachPath((path, schemaType) => {
        if (path !== '_id' && schemaType.instance === 'ObjectId') {
          paths.push(path);
        }
      });

      for (const path of paths) {
        const result = await model.collection.updateMany(
          { [path]: { $type: 'string', $regex: OBJECT_ID_PATTERN } },
          [{ $set: { [path]: { $toObjectId: `$${path}` } } }],
        );

        if (result.modifiedCount > 0) {
          converted += result.modifiedCount;
          this.logger.log(
            `Converted ${result.modifiedCount} ${model.collection.collectionName}.${path} value(s) to ObjectId`,
          );
        }
      }
    }

    if (converted > 0) {
      this.logger.log(
        `ObjectId reference migration converted ${converted} value(s) in total`,
      );
    }

    return converted;
  }
}
