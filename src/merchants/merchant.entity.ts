import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Merchant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string | null;
}
