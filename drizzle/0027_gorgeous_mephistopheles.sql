CREATE TABLE "legal_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title_tr" text NOT NULL,
	"title_en" text DEFAULT '' NOT NULL,
	"body_tr" text DEFAULT '' NOT NULL,
	"body_en" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"show_in_footer" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "legal_pages" ADD CONSTRAINT "legal_pages_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "legal_pages_footer_idx" ON "legal_pages" USING btree ("published","show_in_footer","sort_order");--> statement-breakpoint
INSERT INTO "legal_pages" ("slug","title_tr","title_en","body_tr","body_en","published","show_in_footer","sort_order") VALUES
	('kvkk','KVKK Aydınlatma Metni','Privacy Notice (KVKK)','<p>Zümra Akademi olarak kişisel verilerinizin güvenliğine önem veriyoruz. Bu aydınlatma metni 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında hazırlanmıştır.</p><h2>Veri Sorumlusu</h2><p>Bu bölümü admin panelinden düzenleyin.</p><h2>İşlenen Kişisel Veriler</h2><p>Bu bölümü admin panelinden düzenleyin.</p><h2>Haklarınız</h2><p>Bu bölümü admin panelinden düzenleyin.</p>','',false,true,1),
	('gizlilik','Gizlilik Politikası','Privacy Policy','<p>Bu Gizlilik Politikası, hizmetlerimizi kullanırken bilgilerinizin nasıl toplandığını ve korunduğunu açıklar.</p><h2>Topladığımız Bilgiler</h2><p>Bu bölümü admin panelinden düzenleyin.</p><h2>Bilgilerin Kullanımı</h2><p>Bu bölümü admin panelinden düzenleyin.</p>','',false,true,2),
	('kullanim-kosullari','Kullanım Koşulları','Terms of Use','<p>Bu Kullanım Koşulları, platformumuzu kullanımınızı düzenleyen şartları içerir.</p><h2>Hizmet Kullanımı</h2><p>Bu bölümü admin panelinden düzenleyin.</p><h2>Sorumluluklar</h2><p>Bu bölümü admin panelinden düzenleyin.</p>','',false,true,3),
	('cerez-politikasi','Çerez Politikası','Cookie Policy','<p>Web sitemizde çerezler kullanılmaktadır. Bu politika hangi çerezleri neden kullandığımızı açıklar.</p><h2>Çerez Nedir?</h2><p>Bu bölümü admin panelinden düzenleyin.</p><h2>Çerez Tercihleri</h2><p>Bu bölümü admin panelinden düzenleyin.</p>','',false,true,4)
ON CONFLICT ("slug") DO NOTHING;