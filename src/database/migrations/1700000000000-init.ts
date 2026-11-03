import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1700000000000 implements MigrationInterface {
    name = 'Init1700000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "merchants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(150) NOT NULL, "email" character varying(255), "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_7682193bcf281285d0a459c4b1e" UNIQUE ("email"), CONSTRAINT "PK_4fd312ef25f8e05ad47bfe7ed25" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "stores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" uuid NOT NULL, "name" character varying(150) NOT NULL, "address" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7aa6e7d71fa7acdd7ca43d7c9cb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_stores_merchant" ON "stores" ("merchant_id") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(150) NOT NULL, "email" character varying(255) NOT NULL, "password_hash" text NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_stores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "merchant_id" uuid NOT NULL, "store_id" uuid NOT NULL, "role" character varying(20) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_user_stores_role" CHECK ("role" IN ('OWNER','MANAGER','CASHIER')), CONSTRAINT "PK_b8f8a8e066cd32b77e78e8f7bfd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_user_stores_store" ON "user_stores" ("store_id") `);
        await queryRunner.query(`CREATE INDEX "idx_user_stores_user" ON "user_stores" ("user_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_user_store" ON "user_stores" ("user_id", "store_id") `);
        await queryRunner.query(`CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" uuid NOT NULL, "sku" character varying(80) NOT NULL, "name" character varying(180) NOT NULL, "description" text, "price" numeric(12,2) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_products_price_non_negative" CHECK ("price" >= 0), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_product_merchant_sku" ON "products" ("merchant_id", "sku") `);
        await queryRunner.query(`CREATE INDEX "idx_products_merchant" ON "products" ("merchant_id") `);
        await queryRunner.query(`CREATE TABLE "inventory" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" uuid NOT NULL, "store_id" uuid NOT NULL, "product_id" uuid NOT NULL, "quantity" integer NOT NULL DEFAULT '0', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_inventory_quantity_non_negative" CHECK ("quantity" >= 0), CONSTRAINT "PK_82aa5da437c5bbfb80703b08309" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_inventory_merchant_store" ON "inventory" ("merchant_id", "store_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_inventory_store_product" ON "inventory" ("store_id", "product_id") `);
        await queryRunner.query(`CREATE TABLE "sales" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" uuid NOT NULL, "store_id" uuid NOT NULL, "user_id" uuid NOT NULL, "sale_number" character varying(60) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'PENDING', "subtotal" numeric(12,2) NOT NULL, "tax" numeric(12,2) NOT NULL DEFAULT '0', "total" numeric(12,2) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_sales_total_non_negative" CHECK ("total" >= 0), CONSTRAINT "chk_sales_status" CHECK ("status" IN ('PENDING','COMPLETED','FAILED','CANCELLED')), CONSTRAINT "PK_4f0bc990ae81dba46da680895ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_sales_number_store" ON "sales" ("store_id", "sale_number") `);
        await queryRunner.query(`CREATE INDEX "idx_sales_store_created" ON "sales" ("store_id", "created_at") `);
        await queryRunner.query(`CREATE TABLE "sale_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sale_id" uuid NOT NULL, "merchant_id" uuid NOT NULL, "store_id" uuid NOT NULL, "product_id" uuid NOT NULL, "quantity" integer NOT NULL, "unit_price" numeric(12,2) NOT NULL, "line_total" numeric(12,2) NOT NULL, CONSTRAINT "chk_sale_items_quantity_positive" CHECK ("quantity" > 0), CONSTRAINT "PK_5a7dc5b4562a9e590528b3e08ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_sale_items_product" ON "sale_items" ("product_id") `);
        await queryRunner.query(`CREATE INDEX "idx_sale_items_sale" ON "sale_items" ("sale_id") `);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sale_id" uuid NOT NULL, "merchant_id" uuid NOT NULL, "store_id" uuid NOT NULL, "provider" character varying(50) NOT NULL DEFAULT 'MOCK', "provider_reference" character varying(120), "status" character varying(20) NOT NULL, "amount" numeric(12,2) NOT NULL, "response" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_payments_status" CHECK ("status" IN ('PENDING','SUCCESS','FAILED')), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_payments_sale" ON "payments" ("sale_id") `);
        await queryRunner.query(`CREATE TABLE "idempotency_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" uuid NOT NULL, "store_id" uuid NOT NULL, "idempotency_key" character varying(150) NOT NULL, "request_hash" character varying(64) NOT NULL, "sale_id" uuid, "status" character varying(20) NOT NULL DEFAULT 'PROCESSING', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_idem_status" CHECK ("status" IN ('PROCESSING','COMPLETED','FAILED')), CONSTRAINT "PK_8ad20779ad0411107a56e53d0f6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_idempotency_store_key" ON "idempotency_keys" ("store_id", "idempotency_key") `);
        await queryRunner.query(`ALTER TABLE "stores" ADD CONSTRAINT "FK_882687fd3a8a29fa5bf13858a5b" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_stores" ADD CONSTRAINT "FK_63e8380a29134975cd835c52549" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_stores" ADD CONSTRAINT "FK_3f1ba11fac9406d88530816348e" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_stores" ADD CONSTRAINT "FK_aacfd082707f731d4d4c8805d03" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "products" ADD CONSTRAINT "FK_7d80d63e220c4511ab4b6595846" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventory" ADD CONSTRAINT "FK_5d4d86d6fd6ca048c563131a419" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventory" ADD CONSTRAINT "FK_11f936d3d7a959d55b61f2eb685" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventory" ADD CONSTRAINT "FK_732fdb1f76432d65d2c136340dc" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sales" ADD CONSTRAINT "FK_a93d8ad10b6a6912abfa8a4ecf0" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sales" ADD CONSTRAINT "FK_6c1fae113ae666969a94d79d637" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sales" ADD CONSTRAINT "FK_5f282f3656814ec9ca2675aef6f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sale_items" ADD CONSTRAINT "FK_c210a330b80232c29c2ad68462a" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sale_items" ADD CONSTRAINT "FK_4ecae62db3f9e9cc9a368d57adb" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_a9272c4415ef64294b104e378ac" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "idempotency_keys" ADD CONSTRAINT "FK_1b8b8117bf7a89241c0d6af21c5" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "idempotency_keys" ADD CONSTRAINT "FK_6122da2b6134edefd73bd9bbfd9" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "idempotency_keys" DROP CONSTRAINT "FK_6122da2b6134edefd73bd9bbfd9"`);
        await queryRunner.query(`ALTER TABLE "idempotency_keys" DROP CONSTRAINT "FK_1b8b8117bf7a89241c0d6af21c5"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_a9272c4415ef64294b104e378ac"`);
        await queryRunner.query(`ALTER TABLE "sale_items" DROP CONSTRAINT "FK_4ecae62db3f9e9cc9a368d57adb"`);
        await queryRunner.query(`ALTER TABLE "sale_items" DROP CONSTRAINT "FK_c210a330b80232c29c2ad68462a"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP CONSTRAINT "FK_5f282f3656814ec9ca2675aef6f"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP CONSTRAINT "FK_6c1fae113ae666969a94d79d637"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP CONSTRAINT "FK_a93d8ad10b6a6912abfa8a4ecf0"`);
        await queryRunner.query(`ALTER TABLE "inventory" DROP CONSTRAINT "FK_732fdb1f76432d65d2c136340dc"`);
        await queryRunner.query(`ALTER TABLE "inventory" DROP CONSTRAINT "FK_11f936d3d7a959d55b61f2eb685"`);
        await queryRunner.query(`ALTER TABLE "inventory" DROP CONSTRAINT "FK_5d4d86d6fd6ca048c563131a419"`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_7d80d63e220c4511ab4b6595846"`);
        await queryRunner.query(`ALTER TABLE "user_stores" DROP CONSTRAINT "FK_aacfd082707f731d4d4c8805d03"`);
        await queryRunner.query(`ALTER TABLE "user_stores" DROP CONSTRAINT "FK_3f1ba11fac9406d88530816348e"`);
        await queryRunner.query(`ALTER TABLE "user_stores" DROP CONSTRAINT "FK_63e8380a29134975cd835c52549"`);
        await queryRunner.query(`ALTER TABLE "stores" DROP CONSTRAINT "FK_882687fd3a8a29fa5bf13858a5b"`);
        await queryRunner.query(`DROP INDEX "public"."uq_idempotency_store_key"`);
        await queryRunner.query(`DROP TABLE "idempotency_keys"`);
        await queryRunner.query(`DROP INDEX "public"."idx_payments_sale"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sale_items_sale"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sale_items_product"`);
        await queryRunner.query(`DROP TABLE "sale_items"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sales_store_created"`);
        await queryRunner.query(`DROP INDEX "public"."uq_sales_number_store"`);
        await queryRunner.query(`DROP TABLE "sales"`);
        await queryRunner.query(`DROP INDEX "public"."uq_inventory_store_product"`);
        await queryRunner.query(`DROP INDEX "public"."idx_inventory_merchant_store"`);
        await queryRunner.query(`DROP TABLE "inventory"`);
        await queryRunner.query(`DROP INDEX "public"."idx_products_merchant"`);
        await queryRunner.query(`DROP INDEX "public"."uq_product_merchant_sku"`);
        await queryRunner.query(`DROP TABLE "products"`);
        await queryRunner.query(`DROP INDEX "public"."uq_user_store"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_stores_user"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_stores_store"`);
        await queryRunner.query(`DROP TABLE "user_stores"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."idx_stores_merchant"`);
        await queryRunner.query(`DROP TABLE "stores"`);
        await queryRunner.query(`DROP TABLE "merchants"`);
    }

}
