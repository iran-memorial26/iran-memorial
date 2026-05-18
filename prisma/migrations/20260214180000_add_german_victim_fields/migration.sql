-- AlterTable: Add German (_de) columns to victims table
ALTER TABLE "victims" ADD COLUMN "occupation_de" TEXT;
ALTER TABLE "victims" ADD COLUMN "dreams_de" TEXT;
ALTER TABLE "victims" ADD COLUMN "beliefs_de" TEXT;
ALTER TABLE "victims" ADD COLUMN "personality_de" TEXT;
ALTER TABLE "victims" ADD COLUMN "circumstances_de" TEXT;
ALTER TABLE "victims" ADD COLUMN "burial_circumstances_de" TEXT;
ALTER TABLE "victims" ADD COLUMN "family_persecution_de" TEXT;
