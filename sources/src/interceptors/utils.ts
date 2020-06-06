import { Entity, Filter, RelationType } from "@loopback/repository";

import { AuthorizationMetadata } from "@loopback/authorization";

import { Ctor, ControllerScope } from "../types";

import { CRUDController } from "../servers";

export function getId<Model extends Entity>(ctor: Ctor<Model>) {
    if ("id" in ctor.definition.properties) {
        return "id";
    }

    return ctor.getIdProperties()[0];
}

/**
 *
 *  Ctor:       X
 *  Relations:  [ys, z, t]
 *
 *  RootCtor:       ()
 *  RootRelations:  [xs, ys, z, t]
 *
 *  () --xs         --> [X] --ys        --> [Y] --z         --> [Z] --t         --> [T]
 *  () --HasMany    --> [X] --HasMany   --> [Y] --BelongsTo --> [Z] --HasOne    --> [T]
 *
 * ----------------------------------------------------------------------------------------
 *
 *  Algorithm:
 *
 *      RootCtor;
 *      RootRelations.map(relation => {
 *          if (RootCtor[relation].targetsMany) {
 *              return Y_id;
 *          }
 *
 *          RootCtor = RootCtor[relation].target();
 *      }).filter(id => Boolean(id));
 *
 * ----------------------------------------------------------------------------------------
 *
 *  Result:
 *
 *      1. x_id
 *      2. y_id
 *
 */
export function generateIds<Model extends Entity>(
    ctor: Ctor<Model>,
    relations: string[]
): string[] {
    let rootCtor = ({
        definition: {
            relations: {
                [`${ctor.name.toLowerCase()}s`]: {
                    name: `${ctor.name.toLowerCase()}s`,
                    type: RelationType.hasMany,
                    targetsMany: true,
                    source: ctor,
                    target: () => ctor,
                },
            },
        },
    } as any) as Ctor<Model>;
    let rootRelations = [`${ctor.name.toLowerCase()}s`, ...relations];

    const ids = rootRelations
        .map((relation, index) => {
            let result = undefined;

            if (
                rootCtor.definition.relations[relation].targetsMany &&
                index !== rootRelations.length - 1
            ) {
                result = `${rootCtor.definition.relations[relation]
                    .target()
                    .name.toLowerCase()}_id`;
            }

            rootCtor = rootCtor.definition.relations[relation].target();

            return result;
        })
        .filter((id) => Boolean(id));

    return ids as string[];
}

/**
 *
 *  Ctor:       X
 *  Relations:  [ys, z, t]
 *
 *  RootCtor:       ()
 *  RootRelations:  [xs, ys, z, t]
 *
 *  () --xs         --> [X] --ys        --> [Y] --z         --> [Z] --t         --> [T]
 *  () --HasMany    --> [X] --HasMany   --> [Y] --BelongsTo --> [Z] --HasOne    --> [T]
 *
 * ----------------------------------------------------------------------------------------
 *
 *  Algorithm:
 *
 *      RootCtor;
 *      RootRelations.map(relation => {
 *          if (RootCtor[relation].targetsMany) {
 *              return Relation.name/{Y_id};
 *          } else {
 *              return Relation.name;
 *          }
 *
 *          RootCtor = RootCtor[relation].target();
 *      });
 *
 * ----------------------------------------------------------------------------------------
 *
 *  Result:
 *
 *      1. /xs/{x_id}
 *      2. /ys/{y_id}
 *      3. /z
 *      4. /t
 *
 */
export function generatePath<Model extends Entity>(
    ctor: Ctor<Model>,
    relations: string[],
    basePath: string
): string {
    let rootCtor = ({
        definition: {
            relations: {
                [`${ctor.name.toLowerCase()}s`]: {
                    name: `${ctor.name.toLowerCase()}s`,
                    type: RelationType.hasMany,
                    targetsMany: true,
                    source: ctor,
                    target: () => ctor,
                },
            },
        },
    } as any) as Ctor<Model>;
    let rootRelations = [`${ctor.name.toLowerCase()}s`, ...relations];

    const tokens = rootRelations.map((relation, index) => {
        let result = `/${rootCtor.definition.relations[
            relation
        ].name.toLowerCase()}`;

        if (
            rootCtor.definition.relations[relation].targetsMany &&
            index !== rootRelations.length - 1
        ) {
            result = `${result}/{${rootCtor.definition.relations[relation]
                .target()
                .name.toLowerCase()}_id}`;
        }

        rootCtor = rootCtor.definition.relations[relation].target();

        return result;
    });

    return `${basePath}${tokens.join("")}`;
}

/**
 *
 *  Ctor:       X
 *  Relations:  [ys, z, t]
 *
 *  RootCtor:       ()
 *  RootRelations:  [xs, ys, z, t]
 *
 *  () --xs         --> [X] --ys        --> [Y] --z         --> [Z] --t         --> [T]
 *  () --HasMany    --> [X] --HasMany   --> [Y] --BelongsTo --> [Z] --HasOne    --> [T]
 *
 * ----------------------------------------------------------------------------------------
 *
 *  Algorithm:
 *
 *      Filter = {};
 *      RootCtor;
 *      RootRelations.reduce((filter, relation) => {
 *          if (RootCtor[relation].targetsMany) {
 *              filter.include = [
 *                  relation: relation,
 *                  scope: {
 *                      where: {id: ids.shift()}
 *                  }
 *              ];
 *          } else {
 *              filter.include = [
 *                  relation: relation,
 *                  scope: {}
 *              ];
 *          }
 *
 *          RootCtor = RootCtor[relation].target();
 *
 *          return filter.include[0].scope || {};
 *      }, filter);
 *
 * ----------------------------------------------------------------------------------------
 *
 *  Result:
 *
 *      {
 *          include: [{
 *              relation: xs
 *              scope: {
 *                  where: {id: x_id},
 *
 *                  include: [{
 *                      relation: ys,
 *                      scope: {
 *                          where: {id: y_id},
 *
 *                          include: [{
 *                              relation: z,
 *                              scope: {
 *
 *                                  include: [{
 *                                      relation: t,
 *                                      scope: {}
 *                                  }]
 *
 *                              }
 *                          }]
 *
 *                      }
 *                  }]
 *
 *              }
 *          }]
 *      }
 *
 */
export function generateFilter<Model extends Entity>(
    ctor: Ctor<Model>,
    relations: string[],
    ids: string[]
): Filter<Model> | undefined {
    let rootCtor = ({
        definition: {
            relations: {
                [`${ctor.name.toLowerCase()}s`]: {
                    name: `${ctor.name.toLowerCase()}s`,
                    type: RelationType.hasMany,
                    targetsMany: true,
                    source: ctor,
                    target: () => ctor,
                },
            },
        },
    } as any) as Ctor<Model>;
    let rootRelations = [`${ctor.name.toLowerCase()}s`, ...relations];

    let filter: Filter<any> = {};
    rootRelations.pop();

    rootRelations.reduce((filter, relation) => {
        if (rootCtor.definition.relations[relation].targetsMany) {
            filter.include = [
                {
                    relation: relation,
                    scope: {
                        where: {
                            [getId(
                                rootCtor.definition.relations[relation].target()
                            )]: ids.shift(),
                        },
                    },
                },
            ];
        } else {
            filter.include = [
                {
                    relation: relation,
                    scope: {},
                },
            ];
        }

        rootCtor = rootCtor.definition.relations[relation].target();

        return filter.include[0].scope || {};
    }, filter);

    if (filter.include && filter.include[0]) {
        return filter.include[0].scope as any;
    }
}

/**
 *
 *  Ctor:       X
 *  Relations:  [ys, z, t]
 *
 *  RootCtor:       ()
 *  RootRelations:  [xs, ys, z, t]
 *
 *  () --xs         --> [X] --ys        --> [Y] --z         --> [Z] --t         --> [T]
 *  () --HasMany    --> [X] --HasMany   --> [Y] --BelongsTo --> [Z] --HasOne    --> [T]
 *
 * ----------------------------------------------------------------------------------------
 *
 *  Algorithm:
 *
 *      RootCtor;
 *      RootRelations.reduce((metadata, relation) => {
 *          return RootCtor[relation];
 *
 *          RootCtor = RootCtor[relation].target();
 *      }, undefined);
 *
 * ----------------------------------------------------------------------------------------
 *
 *  Result:
 *
 *      {
 *          name: t,
 *          type: RelationType.hasOne,
 *          tagetsMany: false,
 *          source: () => Z,
 *          target: () => T
 *      }
 *
 */
export function generateMetadata<Model extends Entity>(
    ctor: Ctor<Model>,
    relations: string[]
) {
    let rootCtor = ({
        definition: {
            relations: {
                [`${ctor.name.toLowerCase()}s`]: {
                    name: `${ctor.name.toLowerCase()}s`,
                    type: RelationType.hasMany,
                    targetsMany: true,
                    source: ctor,
                    target: () => ctor,
                },
            },
        },
    } as any) as Ctor<Model>;
    let rootRelations = [`${ctor.name.toLowerCase()}s`, ...relations];

    return rootRelations.reduce((relationMetadata, relation) => {
        relationMetadata = rootCtor.definition.relations[relation];

        rootCtor = relationMetadata.target();

        return relationMetadata;
    }, undefined as any);
}

/**
 *
 *  Scope:      {X}
 *  Relations:  [ys, z, t]
 *
 *  {X} --ys        --> {Y} --z         --> {Z} --t         --> {T}
 *
 * ----------------------------------------------------------------------------------------
 *
 *  Algorithm:
 *
 *      Scope;
 *      Relations.reduce((metadata, relation) => {
 *          metadata.push(Scope[type]);
 *
 *          Scope = Scope.include[relation];
 *      }, {voters: [], scopes: []});
 *
 * ----------------------------------------------------------------------------------------
 *
 *  Result:
 *
 *      {
 *          voters: [...],
 *          scopes: [...]
 *      }
 *
 */
export function generateRootAccess<
    Model extends Entity,
    ModelID,
    ModelRelations extends object,
    Controller extends CRUDController
>(
    type: "create" | "read" | "update" | "delete",
    scope: ControllerScope<Model, ModelID, ModelRelations, Controller>,
    relations: string[]
): AuthorizationMetadata {
    return relations.reduce<AuthorizationMetadata>(
        (authorizationMetadata, relation) => {
            const metadata = scope[type];

            authorizationMetadata.voters?.push(...(metadata?.voters || []));
            authorizationMetadata.scopes?.push(...(metadata?.scopes || []));

            scope = scope.include[relation];

            return authorizationMetadata;
        },
        { voters: [], scopes: [] }
    );
}

/**
 *
 *  Scope:      {X}
 *
 * ----------------------------------------------------------------------------------------
 *
 *  Algorithm:
 *
 *      Scope;
 *      Models[].reduce((metadata, model) => {
 *
 *          metadata.push(getMetadata(type, scope, model)[type]);
 *
 *      }, {voters: [], scopes: [], ...Scope[type]});
 *
 *      Scope;
 *      Object.keys(Models).filter(([_, value]) => typeof value === "object").reduce((metadata, [key, value]) => {
 *
 *          metadata.push(getMetadata(type, scope.include[key], value)[type]);
 *
 *      }, {voters: [], scopes: [], ...Scope[type]});
 *
 *      Scope;
 *      (Filter.include || []).reduce((metadata, inclusion) => {
 *
 *          metadata.push(getMetadata(type, scope.include[inclusion.relation], inclusion.scope)[type]);
 *
 *      }, {voters: [], scopes: [], ...Scope[type]});
 *
 * ----------------------------------------------------------------------------------------
 *
 *  Result:
 *
 *      {
 *          voters: [...],
 *          scopes: [...]
 *      }
 *
 */
export function generateLeafAccess<
    Model extends Entity,
    ModelID,
    ModelRelations extends object,
    Controller extends CRUDController
>(
    type: "create" | "read" | "update" | "delete",
    scope: ControllerScope<Model, ModelID, ModelRelations, Controller>,
    entity: Model[] | Model | Filter
): AuthorizationMetadata {
    if (type === "create" && Array.isArray(entity)) {
        // Model[]
        return entity.reduce<AuthorizationMetadata>(
            (authorizationMetadata, model) => {
                const metadata = generateLeafAccess(type, scope, model);

                authorizationMetadata.voters?.push(...(metadata?.voters || []));
                authorizationMetadata.scopes?.push(...(metadata?.scopes || []));

                return authorizationMetadata;
            },
            { voters: [], scopes: [], ...scope[type] }
        );
    } else if (type === "create" || type === "update") {
        // Model
        return Object.keys(entity)
            .filter(([_, value]) => typeof value === "object")
            .reduce<AuthorizationMetadata>(
                (authorizationMetadata, [key, value]) => {
                    const metadata = generateLeafAccess(
                        type,
                        scope.include[key],
                        value
                    );

                    authorizationMetadata.voters?.push(
                        ...(metadata?.voters || [])
                    );
                    authorizationMetadata.scopes?.push(
                        ...(metadata?.scopes || [])
                    );

                    return authorizationMetadata;
                },
                { voters: [], scopes: [], ...scope[type] }
            );
    } else {
        // Filter
        return ((entity as Filter).include || []).reduce<AuthorizationMetadata>(
            (authorizationMetadata, inclusion) => {
                const metadata = generateLeafAccess(
                    type,
                    scope.include[inclusion.relation],
                    inclusion.scope
                );

                authorizationMetadata.voters?.push(...(metadata?.voters || []));
                authorizationMetadata.scopes?.push(...(metadata?.scopes || []));

                return authorizationMetadata;
            },
            { voters: [], scopes: [], ...scope[type] }
        );
    }
}
